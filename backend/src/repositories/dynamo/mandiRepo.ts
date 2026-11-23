import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { MandiPrice } from '../../models/mandi';
import type { Page, PageRequest } from '../../utils/pagination';
import type { MandiFilters, MandiRepository } from '../types';
import { getItem, putItem, queryPage, scanPage, type QuerySpec } from './helpers';

function keys(p: MandiPrice) {
  return {
    pk: `PRICE#${p.id}`,
    sk: 'META',
    gsi1pk: `CROP#${p.crop}`,
    gsi1sk: `${p.date}#${p.state}#${p.mandi}#${p.id}`,
    gsi2pk: `STATE#${p.state}`,
    gsi2sk: `${p.date}#${p.crop}#${p.id}`,
  };
}

export class DynamoMandiRepository implements MandiRepository {
  constructor(private client: DynamoDBDocumentClient, private table: string) {}

  put(item: MandiPrice): Promise<void> {
    return putItem(this.client, this.table, keys(item), item);
  }

  get(id: string): Promise<MandiPrice | null> {
    return getItem<MandiPrice>(this.client, this.table, `PRICE#${id}`);
  }

  query(filters: MandiFilters, page: PageRequest): Promise<Page<MandiPrice>> {
    const names: Record<string, string> = { '#data': 'data' };
    const values: Record<string, unknown> = {};
    const filtersExpr: string[] = [];

    const addEq = (field: string, value: string | undefined, token: string) => {
      if (!value) return;
      names[`#${field}`] = field;
      values[token] = value;
      filtersExpr.push(`#data.#${field} = ${token}`);
    };

    // Date key-condition helpers shared by both GSIs (sk starts with date).
    const dateCondition = (skAttr: string): string => {
      if (filters.date) {
        values[':datePrefix'] = `${filters.date}#`;
        return `begins_with(${skAttr}, :datePrefix)`;
      }
      if (filters.dateFrom && filters.dateTo) {
        values[':from'] = filters.dateFrom;
        values[':to'] = `${filters.dateTo}#~`;
        return `${skAttr} BETWEEN :from AND :to`;
      }
      if (filters.dateFrom) {
        values[':from'] = filters.dateFrom;
        return `${skAttr} >= :from`;
      }
      if (filters.dateTo) {
        values[':to'] = `${filters.dateTo}#~`;
        return `${skAttr} <= :to`;
      }
      return '';
    };

    if (filters.crop) {
      addEq('state', filters.state, ':state');
      addEq('district', filters.district, ':district');
      addEq('mandi', filters.mandi, ':mandi');
      const dc = dateCondition('gsi1sk');
      const spec: QuerySpec = {
        indexName: 'gsi1',
        keyCondition: `gsi1pk = :crop${dc ? ` AND ${dc}` : ''}`,
        ...(filtersExpr.length ? { filter: filtersExpr.join(' AND ') } : {}),
        names,
        values: { ...values, ':crop': `CROP#${filters.crop}` },
      };
      return queryPage<MandiPrice>(this.client, this.table, spec, page);
    }

    if (filters.state) {
      addEq('district', filters.district, ':district');
      addEq('mandi', filters.mandi, ':mandi');
      const dc = dateCondition('gsi2sk');
      const spec: QuerySpec = {
        indexName: 'gsi2',
        keyCondition: `gsi2pk = :state${dc ? ` AND ${dc}` : ''}`,
        ...(filtersExpr.length ? { filter: filtersExpr.join(' AND ') } : {}),
        names,
        values: { ...values, ':state': `STATE#${filters.state}` },
      };
      return queryPage<MandiPrice>(this.client, this.table, spec, page);
    }

    // No crop/state: bounded scan with filters (documented limitation at scale).
    addEq('crop', filters.crop, ':crop');
    addEq('district', filters.district, ':district');
    addEq('mandi', filters.mandi, ':mandi');
    if (filters.date) {
      names['#date'] = 'date';
      values[':date'] = filters.date;
      filtersExpr.push('#data.#date = :date');
    }
    const expression = ['begins_with(pk, :prefix)', ...filtersExpr].join(' AND ');
    return scanPage<MandiPrice>(this.client, this.table, page, {
      expression,
      names,
      values: { ...values, ':prefix': 'PRICE#' },
    });
  }
}