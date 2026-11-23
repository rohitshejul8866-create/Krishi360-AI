import type { Scheme } from '../types'

export interface SchemeFilters {
  query: string
  category: string
  state: string
}

export const schemeService = {
  filter(schemes: Scheme[], filters: SchemeFilters): Scheme[] {
    const query = filters.query.trim().toLowerCase()
    return schemes.filter((scheme) => {
      const matchesCategory = filters.category === 'All categories' || scheme.category === filters.category
      const matchesState = filters.state === 'All states' || scheme.state === filters.state || scheme.state === 'All India'
      const matchesQuery =
        !query ||
        [scheme.name, scheme.summary, scheme.category, ...scheme.tags].some((value) =>
          value.toLowerCase().includes(query),
        )
      return matchesCategory && matchesState && matchesQuery
    })
  },

  applicationStages: ['Details review', 'Documents checklist', 'Application preparation', 'Submitted (demo)'],

  nextStage(progress: number) {
    const stages = this.applicationStages
    const nextProgress = Math.min(100, progress + 25)
    return {
      progress: nextProgress,
      stage: stages[Math.min(stages.length - 1, Math.floor(nextProgress / 25))],
      complete: nextProgress >= 100,
    }
  },
}
