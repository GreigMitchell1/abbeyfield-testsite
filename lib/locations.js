'use strict';

const data = require('../data/locations.json');

const REGIONS = {
  north: 'North of Scotland',
  east: 'East of Scotland',
  west: 'West of Scotland',
};

const CATEGORIES = {
  'care-home': 'Care Home',
  'nursing-care': 'Nursing Care',
  'sheltered-housing': 'Sheltered Housing',
  other: 'Other services',
};

const locations = data.locations;
const bySlug = new Map(locations.map((l) => [l.slug, l]));

/**
 * Filter locations by region, category and vacancy flag.
 * Unknown filter values are ignored rather than returning an empty list.
 */
function filterLocations({ region, category, vacancies } = {}) {
  return locations.filter((l) => {
    if (region && REGIONS[region] && l.region !== region) return false;
    if (category && CATEGORIES[category] && !l.categories.includes(category)) return false;
    if (vacancies && !l.vacancies) return false;
    return true;
  });
}

module.exports = {
  REGIONS,
  CATEGORIES,
  meta: data.meta,
  all: locations,
  find: (slug) => bySlug.get(slug),
  filter: filterLocations,
};
