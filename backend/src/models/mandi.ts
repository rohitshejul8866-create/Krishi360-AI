/** MandiSmart domain models. Sample data is always distinguishable from verified data. */

export type DataType = 'sample' | 'verified';

export interface MandiPrice {
  id: string;
  crop: string;
  state: string;
  district: string;
  mandi: string;
  /** INR per quintal unless stated otherwise. */
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  unit: string;
  /** YYYY-MM-DD trading date. */
  date: string;
  source: string;
  dataType: DataType;
  changePct?: number;
  lastUpdatedAt: string;
  createdAt: string;
  version: number;
}