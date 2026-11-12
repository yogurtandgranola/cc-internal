// The company's properties by name, city and state only. No tenant, financial or investor data.
// Seeded into an empty properties table the first time the owner signs in, so the permission pickers list real parks.
// Edit or add more on the Admin page. Where the location is not known here it is left empty.
export const SEED_PROPERTIES: { id: string; name: string; city: string | null; state: string | null }[] = [
  { id: "1920-mhc", name: "1920 MHC", city: null, state: null },
  { id: "caddo-valley-rv", name: "Caddo Valley RV", city: "Caddo Valley", state: "AR" },
  { id: "deerfield-mhc", name: "Deerfield MHC", city: "Murfreesboro", state: "NC" },
  { id: "emporia", name: "Emporia", city: "Emporia", state: "VA" },
  { id: "fortescue-park", name: "Fortescue Park", city: "Fortescue", state: "NJ" },
  { id: "lincoln-park", name: "Lincoln Park MH/RV", city: "Oklahoma City", state: "OK" },
  { id: "parktown", name: "Parktown", city: null, state: null },
  { id: "redwood-court-mhc", name: "Redwood Court MHC", city: "Vineland", state: "NJ" },
  { id: "shady-acres-mhc", name: "Shady Acres MHC", city: "Danbury", state: "CT" },
  { id: "spring-brook", name: "Spring Brook", city: null, state: null },
  { id: "springhill-mhc", name: "Springhill MHC", city: "Louisa", state: "KY" },
  { id: "sunflower-estates", name: "Sunflower Estates", city: "Great Bend", state: "KS" },
];
