/**
 * COUNTRY PACKS DATA - Machine-Readable Regulatory & Grid Information
 *
 * This file contains verified official domains and regulatory requirements
 * for data center grid connections across European markets.
 *
 * Sources are official government, regulatory, and TSO/DSO websites.
 */

import { z } from 'zod';

// ════════════════════════════════════════════════════════════════════════════
// COUNTRY PACK SCHEMA
// ════════════════════════════════════════════════════════════════════════════

export const ArtefactDefinition = z.object({
  id: z.string(),
  name: z.string(),
  name_local: z.string().nullable(),
  description: z.string(),
  required_for: z.array(z.enum(['power_title', 'firmness', 'queue_maintenance', 'energization'])),
  typical_issuer: z.string(),
  validity_months: z.number().nullable(),
  verification_url: z.string().nullable(),
});

export const QueueRule = z.object({
  rule_type: z.enum(['use_it_or_lose_it', 'milestone_based', 'deposit_based', 'first_come_first_served']),
  description: z.string(),
  typical_timeline_months: z.number().nullable(),
  penalty_for_miss: z.string().nullable(),
});

export const CountryPackData = z.object({
  country_code: z.string().length(2),
  country_name: z.string(),
  country_name_local: z.string(),

  // Official domains for web search
  allowed_domains: z.array(z.string()),

  // Regulatory bodies
  energy_regulator: z.object({
    name: z.string(),
    website: z.string(),
    role: z.string(),
  }),

  // Transmission System Operator(s)
  tso: z.array(z.object({
    name: z.string(),
    website: z.string(),
    coverage: z.string(),
  })),

  // Distribution System Operator(s) - main ones
  dso: z.array(z.object({
    name: z.string(),
    website: z.string(),
    coverage: z.string(),
  })),

  // Government / Ministry
  government_energy: z.object({
    name: z.string(),
    website: z.string(),
  }),

  // Planning / Permits
  planning_authority: z.object({
    name: z.string(),
    website: z.string().nullable(),
    notes: z.string(),
  }),

  // Grid connection process
  connection_process: z.object({
    typical_timeline_months: z.object({
      application_to_offer: z.number(),
      offer_to_agreement: z.number(),
      agreement_to_energization: z.number(),
    }),
    queue_rules: z.array(QueueRule),
    firmness_options: z.array(z.enum(['firm', 'non_firm', 'flex', 'interruptible'])),
    flex_mechanism_name: z.string().nullable(),
  }),

  // Required artefacts
  artefacts: z.array(ArtefactDefinition),

  // Market characteristics
  market_notes: z.object({
    key_hubs: z.array(z.string()),
    grid_congestion_risk: z.enum(['low', 'medium', 'high']),
    renewable_curtailment_common: z.boolean(),
    data_center_specific_rules: z.string().nullable(),
    recent_regulatory_changes: z.string().nullable(),
  }),
});

export type CountryPackDataType = z.infer<typeof CountryPackData>;

// ════════════════════════════════════════════════════════════════════════════
// COUNTRY PACKS DATABASE
// ════════════════════════════════════════════════════════════════════════════

export const COUNTRY_PACKS: Record<string, CountryPackDataType> = {
  // ──────────────────────────────────────────────────────────────────────────
  // FRANCE
  // ──────────────────────────────────────────────────────────────────────────
  FR: {
    country_code: 'FR',
    country_name: 'France',
    country_name_local: 'France',
    allowed_domains: [
      'rte-france.com',           // TSO
      'enedis.fr',                // Main DSO
      'cre.fr',                   // Energy regulator
      'ecologie.gouv.fr',         // Ministry of Ecological Transition
      'economie.gouv.fr',         // Ministry of Economy
      'legifrance.gouv.fr',       // Legal texts
      'services-rte.com',         // RTE services portal
      'data.gouv.fr',             // Government data portal
    ],
    energy_regulator: {
      name: 'Commission de Régulation de l\'Énergie (CRE)',
      website: 'https://www.cre.fr',
      role: 'Independent energy regulator overseeing electricity and gas markets',
    },
    tso: [{
      name: 'RTE (Réseau de Transport d\'Électricité)',
      website: 'https://www.rte-france.com',
      coverage: 'National transmission grid (>50kV)',
    }],
    dso: [{
      name: 'Enedis',
      website: 'https://www.enedis.fr',
      coverage: '95% of distribution grid',
    }],
    government_energy: {
      name: 'Ministère de la Transition Écologique',
      website: 'https://www.ecologie.gouv.fr',
    },
    planning_authority: {
      name: 'Préfecture / DREAL',
      website: null,
      notes: 'Building permits (Permis de Construire) handled by local Préfecture. ICPE authorization required for data centers >1MW.',
    },
    connection_process: {
      typical_timeline_months: {
        application_to_offer: 6,
        offer_to_agreement: 3,
        agreement_to_energization: 24,
      },
      queue_rules: [
        {
          rule_type: 'milestone_based',
          description: 'PTF (Proposition Technique et Financière) must be accepted within 3 months. Deposit required.',
          typical_timeline_months: 3,
          penalty_for_miss: 'Loss of queue position',
        },
        {
          rule_type: 'use_it_or_lose_it',
          description: 'S3REnR rules may apply for renewable-heavy regions',
          typical_timeline_months: 36,
          penalty_for_miss: 'Capacity release back to queue',
        },
      ],
      firmness_options: ['firm', 'non_firm'],
      flex_mechanism_name: 'Effacement (demand response)',
    },
    artefacts: [
      {
        id: 'fr_ptf',
        name: 'Technical and Financial Proposal',
        name_local: 'Proposition Technique et Financière (PTF)',
        description: 'Official connection offer from RTE/Enedis with technical solution and cost',
        required_for: ['power_title', 'queue_maintenance'],
        typical_issuer: 'RTE or Enedis',
        validity_months: 3,
        verification_url: 'https://www.services-rte.com',
      },
      {
        id: 'fr_convention',
        name: 'Connection Agreement',
        name_local: 'Convention de Raccordement',
        description: 'Binding agreement confirming capacity reservation',
        required_for: ['power_title', 'firmness'],
        typical_issuer: 'RTE or Enedis',
        validity_months: null,
        verification_url: null,
      },
      {
        id: 'fr_attestation',
        name: 'Connection Certificate',
        name_local: 'Attestation de Conformité',
        description: 'Certificate confirming installation meets grid requirements',
        required_for: ['energization'],
        typical_issuer: 'Consuel',
        validity_months: null,
        verification_url: 'https://www.consuel.com',
      },
      {
        id: 'fr_icpe',
        name: 'Environmental Authorization',
        name_local: 'Autorisation ICPE',
        description: 'Required for installations >1MW electrical capacity',
        required_for: ['energization'],
        typical_issuer: 'Préfecture',
        validity_months: null,
        verification_url: null,
      },
    ],
    market_notes: {
      key_hubs: ['Paris (La Courneuve, Pantin)', 'Marseille', 'Lyon'],
      grid_congestion_risk: 'medium',
      renewable_curtailment_common: false,
      data_center_specific_rules: 'ICPE authorization required for >1MW. Heat reuse discussions ongoing but not yet mandatory.',
      recent_regulatory_changes: 'S3REnR regional planning schemes being updated. Grid reinforcement funds available.',
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // GERMANY
  // ──────────────────────────────────────────────────────────────────────────
  DE: {
    country_code: 'DE',
    country_name: 'Germany',
    country_name_local: 'Deutschland',
    allowed_domains: [
      'bundesnetzagentur.de',     // Federal Network Agency (regulator)
      'tennet.eu',                // TSO (North)
      'amprion.net',              // TSO (West)
      '50hertz.com',              // TSO (East)
      'transnetbw.de',            // TSO (South)
      'bmwk.de',                  // Federal Ministry for Economic Affairs
      'gesetze-im-internet.de',   // Legal texts
      'netztransparenz.de',       // Grid transparency platform
      'smard.de',                 // Electricity market data
    ],
    energy_regulator: {
      name: 'Bundesnetzagentur (BNetzA)',
      website: 'https://www.bundesnetzagentur.de',
      role: 'Federal network agency regulating electricity, gas, telecoms, post, and railway',
    },
    tso: [
      { name: 'TenneT TSO', website: 'https://www.tennet.eu', coverage: 'Northern Germany' },
      { name: 'Amprion', website: 'https://www.amprion.net', coverage: 'Western Germany' },
      { name: '50Hertz', website: 'https://www.50hertz.com', coverage: 'Eastern Germany' },
      { name: 'TransnetBW', website: 'https://www.transnetbw.de', coverage: 'Baden-Württemberg' },
    ],
    dso: [
      { name: 'E.ON/Westnetz', website: 'https://www.westnetz.de', coverage: 'Major regional DSO' },
      { name: 'Stromnetz Berlin', website: 'https://www.stromnetz.berlin', coverage: 'Berlin' },
    ],
    government_energy: {
      name: 'Bundesministerium für Wirtschaft und Klimaschutz (BMWK)',
      website: 'https://www.bmwk.de',
    },
    planning_authority: {
      name: 'Bauamt (Building Authority)',
      website: null,
      notes: 'Building permits handled at municipal level (Baugenehmigung). BImSchG approval may be required for emissions.',
    },
    connection_process: {
      typical_timeline_months: {
        application_to_offer: 8,
        offer_to_agreement: 2,
        agreement_to_energization: 30,
      },
      queue_rules: [
        {
          rule_type: 'deposit_based',
          description: 'Netzanschlusszusage (connection commitment) requires deposit payment',
          typical_timeline_months: 2,
          penalty_for_miss: 'Forfeit of deposit, loss of position',
        },
      ],
      firmness_options: ['firm', 'interruptible'],
      flex_mechanism_name: 'Abschaltbare Lasten (interruptible loads)',
    },
    artefacts: [
      {
        id: 'de_netzanschlusszusage',
        name: 'Grid Connection Commitment',
        name_local: 'Netzanschlusszusage',
        description: 'Binding commitment from grid operator for connection',
        required_for: ['power_title'],
        typical_issuer: 'TSO or DSO',
        validity_months: 24,
        verification_url: null,
      },
      {
        id: 'de_netzanschlussvertrag',
        name: 'Grid Connection Agreement',
        name_local: 'Netzanschlussvertrag',
        description: 'Detailed contractual agreement for grid connection',
        required_for: ['power_title', 'firmness'],
        typical_issuer: 'TSO or DSO',
        validity_months: null,
        verification_url: null,
      },
      {
        id: 'de_baugenehmigung',
        name: 'Building Permit',
        name_local: 'Baugenehmigung',
        description: 'Construction authorization from local building authority',
        required_for: ['energization'],
        typical_issuer: 'Bauamt',
        validity_months: 36,
        verification_url: null,
      },
    ],
    market_notes: {
      key_hubs: ['Frankfurt (FLAPD)', 'Berlin', 'Munich', 'Hamburg', 'Düsseldorf'],
      grid_congestion_risk: 'high',
      renewable_curtailment_common: true,
      data_center_specific_rules: 'Energieeffizienzgesetz (EnEfG) 2023 requires heat reuse plans for new data centers >1MW. PUE reporting mandatory.',
      recent_regulatory_changes: 'Energy Efficiency Act (EnEfG) 2023 introduced strict requirements. Heat reuse obligation for new builds.',
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // NETHERLANDS
  // ──────────────────────────────────────────────────────────────────────────
  NL: {
    country_code: 'NL',
    country_name: 'Netherlands',
    country_name_local: 'Nederland',
    allowed_domains: [
      'acm.nl',                   // Authority for Consumers & Markets
      'tennet.eu',                // TSO
      'liander.nl',               // Major DSO
      'stedin.nl',                // DSO
      'enexis.nl',                // DSO
      'rvo.nl',                   // Netherlands Enterprise Agency
      'rijksoverheid.nl',         // Government
      'infomil.nl',               // Environmental info
      'netbeheernederland.nl',    // Grid operators association
    ],
    energy_regulator: {
      name: 'Autoriteit Consument & Markt (ACM)',
      website: 'https://www.acm.nl',
      role: 'Consumer and market authority, including energy regulation',
    },
    tso: [{
      name: 'TenneT TSO',
      website: 'https://www.tennet.eu',
      coverage: 'National transmission grid',
    }],
    dso: [
      { name: 'Liander', website: 'https://www.liander.nl', coverage: 'Amsterdam region, North Holland' },
      { name: 'Stedin', website: 'https://www.stedin.nl', coverage: 'Rotterdam, The Hague, Utrecht' },
      { name: 'Enexis', website: 'https://www.enexis.nl', coverage: 'South, East Netherlands' },
    ],
    government_energy: {
      name: 'Ministerie van Economische Zaken en Klimaat',
      website: 'https://www.rijksoverheid.nl/ministeries/ministerie-van-economische-zaken-en-klimaat',
    },
    planning_authority: {
      name: 'Gemeente (Municipality)',
      website: null,
      notes: 'Omgevingsvergunning (environmental permit) required. Some municipalities have data center moratoriums.',
    },
    connection_process: {
      typical_timeline_months: {
        application_to_offer: 12,
        offer_to_agreement: 3,
        agreement_to_energization: 48,
      },
      queue_rules: [
        {
          rule_type: 'first_come_first_served',
          description: 'Queue congestion in Amsterdam region. Alternative locations may have faster timelines.',
          typical_timeline_months: null,
          penalty_for_miss: null,
        },
        {
          rule_type: 'milestone_based',
          description: 'Must demonstrate project readiness (permits, financing) to maintain position',
          typical_timeline_months: 24,
          penalty_for_miss: 'Position review, potential demotion',
        },
      ],
      firmness_options: ['firm', 'non_firm', 'flex'],
      flex_mechanism_name: 'Congestiemanagement (congestion management)',
    },
    artefacts: [
      {
        id: 'nl_transportindicatie',
        name: 'Transport Indication',
        name_local: 'Transportindicatie',
        description: 'Initial capacity indication from grid operator',
        required_for: ['queue_maintenance'],
        typical_issuer: 'TenneT or DSO',
        validity_months: 12,
        verification_url: null,
      },
      {
        id: 'nl_aansluitovereenkomst',
        name: 'Connection Agreement',
        name_local: 'Aansluit- en Transportovereenkomst (ATO)',
        description: 'Binding connection and transport agreement',
        required_for: ['power_title', 'firmness'],
        typical_issuer: 'TenneT or DSO',
        validity_months: null,
        verification_url: null,
      },
      {
        id: 'nl_omgevingsvergunning',
        name: 'Environmental Permit',
        name_local: 'Omgevingsvergunning',
        description: 'Combined environmental and building permit',
        required_for: ['energization'],
        typical_issuer: 'Municipality',
        validity_months: 36,
        verification_url: null,
      },
    ],
    market_notes: {
      key_hubs: ['Amsterdam (AMS-IX)', 'Schiphol-Rijk', 'Almere'],
      grid_congestion_risk: 'high',
      renewable_curtailment_common: false,
      data_center_specific_rules: 'Several municipalities (Haarlemmermeer, Amsterdam) have moratoriums. Grid congestion severe in Randstad.',
      recent_regulatory_changes: 'National Data Center Strategy 2024. Hyperscale restrictions in some regions. Grid capacity allocation reform ongoing.',
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // IRELAND
  // ──────────────────────────────────────────────────────────────────────────
  IE: {
    country_code: 'IE',
    country_name: 'Ireland',
    country_name_local: 'Éire',
    allowed_domains: [
      'cru.ie',                   // Commission for Regulation of Utilities
      'eirgrid.ie',               // TSO
      'esb.ie',                   // ESB Networks (DSO)
      'esbnetworks.ie',           // ESB Networks portal
      'seai.ie',                  // Sustainable Energy Authority
      'gov.ie',                   // Government
      'irishstatutebook.ie',      // Legislation
    ],
    energy_regulator: {
      name: 'Commission for Regulation of Utilities (CRU)',
      website: 'https://www.cru.ie',
      role: 'Economic regulator for energy and water sectors',
    },
    tso: [{
      name: 'EirGrid',
      website: 'https://www.eirgrid.ie',
      coverage: 'National transmission system',
    }],
    dso: [{
      name: 'ESB Networks',
      website: 'https://www.esbnetworks.ie',
      coverage: 'National distribution network',
    }],
    government_energy: {
      name: 'Department of the Environment, Climate and Communications',
      website: 'https://www.gov.ie/en/organisation/department-of-the-environment-climate-and-communications/',
    },
    planning_authority: {
      name: 'An Bord Pleanála / Local Authority',
      website: 'https://www.pleanala.ie',
      notes: 'Strategic Infrastructure Development (SID) for large data centers. Planning permission from local authority or An Bord Pleanála.',
    },
    connection_process: {
      typical_timeline_months: {
        application_to_offer: 6,
        offer_to_agreement: 3,
        agreement_to_energization: 36,
      },
      queue_rules: [
        {
          rule_type: 'milestone_based',
          description: 'ECP-2 process requires milestone demonstrations. Planning permission proof required.',
          typical_timeline_months: 24,
          penalty_for_miss: 'Connection offer withdrawal',
        },
        {
          rule_type: 'use_it_or_lose_it',
          description: 'Capacity must be energized within agreed timeline or risk clawback',
          typical_timeline_months: 48,
          penalty_for_miss: 'Capacity reduction or termination',
        },
      ],
      firmness_options: ['firm', 'non_firm', 'flex'],
      flex_mechanism_name: 'Demand Side Units (DSU)',
    },
    artefacts: [
      {
        id: 'ie_connection_offer',
        name: 'Connection Offer',
        name_local: 'Connection Offer',
        description: 'Formal offer from EirGrid/ESB Networks',
        required_for: ['power_title'],
        typical_issuer: 'EirGrid or ESB Networks',
        validity_months: 3,
        verification_url: null,
      },
      {
        id: 'ie_connection_agreement',
        name: 'Connection Agreement',
        name_local: 'Connection Agreement',
        description: 'Binding agreement for grid connection',
        required_for: ['power_title', 'firmness'],
        typical_issuer: 'EirGrid or ESB Networks',
        validity_months: null,
        verification_url: null,
      },
      {
        id: 'ie_planning',
        name: 'Planning Permission',
        name_local: 'Planning Permission',
        description: 'Development consent from planning authority',
        required_for: ['queue_maintenance', 'energization'],
        typical_issuer: 'Local Authority or An Bord Pleanála',
        validity_months: 60,
        verification_url: 'https://www.pleanala.ie',
      },
    ],
    market_notes: {
      key_hubs: ['Dublin (Clondalkin, Tallaght, Profile Park)', 'Cork'],
      grid_congestion_risk: 'high',
      renewable_curtailment_common: true,
      data_center_specific_rules: 'CRU Data Centre Grid Connection Policy (2021). Moratorium on new connections lifted but strict conditions. Flex/DSU participation encouraged.',
      recent_regulatory_changes: 'ECP-2.1 connection policy update. System security constraints prioritized. Renewable matching requirements being developed.',
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // SPAIN
  // ──────────────────────────────────────────────────────────────────────────
  ES: {
    country_code: 'ES',
    country_name: 'Spain',
    country_name_local: 'España',
    allowed_domains: [
      'cnmc.es',                  // National Markets Commission
      'ree.es',                   // Red Eléctrica (TSO)
      'i-de.es',                  // Iberdrola distribution
      'edistribucion.com',        // Endesa distribution
      'miteco.gob.es',            // Ministry for Ecological Transition
      'boe.es',                   // Official Gazette
      'mincotur.gob.es',          // Ministry of Industry
    ],
    energy_regulator: {
      name: 'Comisión Nacional de los Mercados y la Competencia (CNMC)',
      website: 'https://www.cnmc.es',
      role: 'Competition and market regulator including energy',
    },
    tso: [{
      name: 'Red Eléctrica de España (REE)',
      website: 'https://www.ree.es',
      coverage: 'National transmission system',
    }],
    dso: [
      { name: 'i-DE (Iberdrola)', website: 'https://www.i-de.es', coverage: 'Northern and Central Spain' },
      { name: 'e-distribución (Endesa)', website: 'https://www.edistribucion.com', coverage: 'Southern and Eastern Spain' },
    ],
    government_energy: {
      name: 'Ministerio para la Transición Ecológica y el Reto Demográfico',
      website: 'https://www.miteco.gob.es',
    },
    planning_authority: {
      name: 'Ayuntamiento / Comunidad Autónoma',
      website: null,
      notes: 'Building permits (Licencia de Obras) at municipal level. AAU (Autorización Ambiental Unificada) for large projects.',
    },
    connection_process: {
      typical_timeline_months: {
        application_to_offer: 6,
        offer_to_agreement: 2,
        agreement_to_energization: 24,
      },
      queue_rules: [
        {
          rule_type: 'milestone_based',
          description: 'RD 1183/2020 milestone regime. Must demonstrate progress (permits, construction).',
          typical_timeline_months: 18,
          penalty_for_miss: 'Capacity forfeiture',
        },
        {
          rule_type: 'deposit_based',
          description: 'Aval (bank guarantee) required to secure capacity',
          typical_timeline_months: null,
          penalty_for_miss: 'Loss of guarantee and position',
        },
      ],
      firmness_options: ['firm', 'non_firm'],
      flex_mechanism_name: 'Gestión de la demanda',
    },
    artefacts: [
      {
        id: 'es_permiso_acceso',
        name: 'Access Permit',
        name_local: 'Permiso de Acceso',
        description: 'Permission to access the grid at a specific point',
        required_for: ['queue_maintenance'],
        typical_issuer: 'REE or DSO',
        validity_months: 24,
        verification_url: null,
      },
      {
        id: 'es_permiso_conexion',
        name: 'Connection Permit',
        name_local: 'Permiso de Conexión',
        description: 'Technical authorization for the connection',
        required_for: ['power_title'],
        typical_issuer: 'REE or DSO',
        validity_months: null,
        verification_url: null,
      },
      {
        id: 'es_aval',
        name: 'Bank Guarantee',
        name_local: 'Aval Bancario',
        description: 'Financial guarantee to secure capacity reservation',
        required_for: ['queue_maintenance', 'power_title'],
        typical_issuer: 'Bank',
        validity_months: null,
        verification_url: null,
      },
    ],
    market_notes: {
      key_hubs: ['Madrid', 'Barcelona', 'Bilbao'],
      grid_congestion_risk: 'medium',
      renewable_curtailment_common: true,
      data_center_specific_rules: 'RD 1183/2020 introduced strict milestone regime to clear speculative queue positions. Large capacity available in some regions.',
      recent_regulatory_changes: 'Milestone regime cleaning up grid queue. New capacity becoming available. Renewable zones (PNIEC) priority areas.',
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // UNITED KINGDOM
  // ──────────────────────────────────────────────────────────────────────────
  GB: {
    country_code: 'GB',
    country_name: 'United Kingdom',
    country_name_local: 'United Kingdom',
    allowed_domains: [
      'ofgem.gov.uk',             // Energy regulator
      'nationalgrideso.com',      // National Grid ESO
      'nationalgrid.com',         // National Grid
      'ukpowernetworks.co.uk',    // UKPN (DSO)
      'ssen.co.uk',               // Scottish & Southern
      'northernpowergrid.com',    // Northern Power Grid
      'gov.uk',                   // Government
      'legislation.gov.uk',       // Legislation
    ],
    energy_regulator: {
      name: 'Office of Gas and Electricity Markets (Ofgem)',
      website: 'https://www.ofgem.gov.uk',
      role: 'Independent energy regulator for electricity and gas markets',
    },
    tso: [{
      name: 'National Grid ESO',
      website: 'https://www.nationalgrideso.com',
      coverage: 'England, Scotland, Wales',
    }],
    dso: [
      { name: 'UK Power Networks', website: 'https://www.ukpowernetworks.co.uk', coverage: 'London, South East, East England' },
      { name: 'Scottish & Southern Electricity Networks', website: 'https://www.ssen.co.uk', coverage: 'Scotland, Southern England' },
      { name: 'Northern Powergrid', website: 'https://www.northernpowergrid.com', coverage: 'North East England, Yorkshire' },
    ],
    government_energy: {
      name: 'Department for Energy Security and Net Zero',
      website: 'https://www.gov.uk/government/organisations/department-for-energy-security-and-net-zero',
    },
    planning_authority: {
      name: 'Local Planning Authority / PINS',
      website: 'https://www.gov.uk/government/organisations/planning-inspectorate',
      notes: 'Planning permission from LPA. Large projects (>50MW generating) go to Planning Inspectorate as NSIP.',
    },
    connection_process: {
      typical_timeline_months: {
        application_to_offer: 3,
        offer_to_agreement: 3,
        agreement_to_energization: 60,
      },
      queue_rules: [
        {
          rule_type: 'first_come_first_served',
          description: 'Queue congestion severe (10+ years in some areas). TMO4+ reforms underway.',
          typical_timeline_months: null,
          penalty_for_miss: null,
        },
        {
          rule_type: 'milestone_based',
          description: 'Ofgem queue reform requires readiness evidence',
          typical_timeline_months: 24,
          penalty_for_miss: 'Queue position review',
        },
      ],
      firmness_options: ['firm', 'non_firm'],
      flex_mechanism_name: 'Demand Flexibility Service',
    },
    artefacts: [
      {
        id: 'gb_connection_offer',
        name: 'Connection Offer',
        name_local: 'Connection Offer',
        description: 'Formal connection offer from network operator',
        required_for: ['power_title'],
        typical_issuer: 'National Grid or DNO',
        validity_months: 3,
        verification_url: null,
      },
      {
        id: 'gb_connection_agreement',
        name: 'Connection Agreement',
        name_local: 'Bilateral Connection Agreement',
        description: 'Binding connection agreement',
        required_for: ['power_title', 'firmness'],
        typical_issuer: 'National Grid or DNO',
        validity_months: null,
        verification_url: null,
      },
      {
        id: 'gb_planning',
        name: 'Planning Permission',
        name_local: 'Planning Permission',
        description: 'Development consent',
        required_for: ['energization'],
        typical_issuer: 'Local Planning Authority',
        validity_months: 36,
        verification_url: null,
      },
    ],
    market_notes: {
      key_hubs: ['London (Slough, Docklands)', 'Manchester', 'Dublin corridor'],
      grid_congestion_risk: 'high',
      renewable_curtailment_common: true,
      data_center_specific_rules: 'No specific DC rules but grid queue reform (TMO4+) prioritizing ready projects. Some regions have 10+ year wait times.',
      recent_regulatory_changes: 'Ofgem Connections Reform. TMO4+ process changes. Queue cleanup targeting speculative applications.',
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // ITALY
  // ──────────────────────────────────────────────────────────────────────────
  IT: {
    country_code: 'IT',
    country_name: 'Italy',
    country_name_local: 'Italia',
    allowed_domains: [
      'arera.it',                 // Energy regulator
      'terna.it',                 // TSO
      'e-distribuzione.it',       // Enel distribution
      'mase.gov.it',              // Ministry of Environment
      'mise.gov.it',              // Ministry of Economic Development
      'gazzettaufficiale.it',     // Official Gazette
    ],
    energy_regulator: {
      name: 'Autorità di Regolazione per Energia Reti e Ambiente (ARERA)',
      website: 'https://www.arera.it',
      role: 'Regulatory authority for energy, networks, and environment',
    },
    tso: [{
      name: 'Terna',
      website: 'https://www.terna.it',
      coverage: 'National transmission grid',
    }],
    dso: [{
      name: 'e-distribuzione (Enel)',
      website: 'https://www.e-distribuzione.it',
      coverage: 'Most of Italy',
    }],
    government_energy: {
      name: 'Ministero dell\'Ambiente e della Sicurezza Energetica',
      website: 'https://www.mase.gov.it',
    },
    planning_authority: {
      name: 'Comune / Regione',
      website: null,
      notes: 'Building permits from municipality. VIA (Environmental Impact Assessment) for large projects.',
    },
    connection_process: {
      typical_timeline_months: {
        application_to_offer: 4,
        offer_to_agreement: 2,
        agreement_to_energization: 24,
      },
      queue_rules: [
        {
          rule_type: 'milestone_based',
          description: 'STMG/TICA process with milestones',
          typical_timeline_months: 18,
          penalty_for_miss: 'Position loss',
        },
      ],
      firmness_options: ['firm', 'non_firm', 'interruptible'],
      flex_mechanism_name: 'Servizio di interrompibilità',
    },
    artefacts: [
      {
        id: 'it_stmg',
        name: 'Minimum Technical Solution',
        name_local: 'Soluzione Tecnica Minima Generale (STMG)',
        description: 'Technical connection proposal',
        required_for: ['power_title'],
        typical_issuer: 'Terna',
        validity_months: 24,
        verification_url: null,
      },
      {
        id: 'it_preventivo',
        name: 'Connection Quote',
        name_local: 'Preventivo di Connessione',
        description: 'Detailed connection cost estimate',
        required_for: ['power_title'],
        typical_issuer: 'Terna or e-distribuzione',
        validity_months: 6,
        verification_url: null,
      },
    ],
    market_notes: {
      key_hubs: ['Milan', 'Rome', 'Turin'],
      grid_congestion_risk: 'medium',
      renewable_curtailment_common: true,
      data_center_specific_rules: 'Growing market. Milan emerging as key hub. Grid reinforcement ongoing in northern regions.',
      recent_regulatory_changes: 'PNRR investments in grid infrastructure. Simplified permitting for strategic projects.',
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // POLAND
  // ──────────────────────────────────────────────────────────────────────────
  PL: {
    country_code: 'PL',
    country_name: 'Poland',
    country_name_local: 'Polska',
    allowed_domains: [
      'ure.gov.pl',               // Energy Regulatory Office
      'pse.pl',                   // PSE (TSO)
      'tauron-dystrybucja.pl',    // Tauron DSO
      'pgedystrybucja.pl',        // PGE DSO
      'energa-operator.pl',       // Energa DSO
      'gov.pl',                   // Government
      'isap.sejm.gov.pl',         // Legislation
    ],
    energy_regulator: {
      name: 'Urząd Regulacji Energetyki (URE)',
      website: 'https://www.ure.gov.pl',
      role: 'Energy Regulatory Office',
    },
    tso: [{
      name: 'Polskie Sieci Elektroenergetyczne (PSE)',
      website: 'https://www.pse.pl',
      coverage: 'National transmission system',
    }],
    dso: [
      { name: 'Tauron Dystrybucja', website: 'https://www.tauron-dystrybucja.pl', coverage: 'Southern Poland' },
      { name: 'PGE Dystrybucja', website: 'https://www.pgedystrybucja.pl', coverage: 'Central/Eastern Poland' },
      { name: 'Energa-Operator', website: 'https://www.energa-operator.pl', coverage: 'Northern Poland' },
    ],
    government_energy: {
      name: 'Ministerstwo Klimatu i Środowiska',
      website: 'https://www.gov.pl/web/klimat',
    },
    planning_authority: {
      name: 'Urząd Miasta/Gminy',
      website: null,
      notes: 'Building permit (Pozwolenie na budowę) from local authority. Environmental decision may be required.',
    },
    connection_process: {
      typical_timeline_months: {
        application_to_offer: 4,
        offer_to_agreement: 2,
        agreement_to_energization: 24,
      },
      queue_rules: [
        {
          rule_type: 'first_come_first_served',
          description: 'Standard queue process',
          typical_timeline_months: null,
          penalty_for_miss: null,
        },
      ],
      firmness_options: ['firm', 'interruptible'],
      flex_mechanism_name: 'DSR (Demand Side Response)',
    },
    artefacts: [
      {
        id: 'pl_warunki',
        name: 'Connection Conditions',
        name_local: 'Warunki Przyłączenia',
        description: 'Technical conditions for connection',
        required_for: ['power_title'],
        typical_issuer: 'PSE or DSO',
        validity_months: 24,
        verification_url: null,
      },
      {
        id: 'pl_umowa',
        name: 'Connection Agreement',
        name_local: 'Umowa o Przyłączenie',
        description: 'Binding connection contract',
        required_for: ['power_title', 'firmness'],
        typical_issuer: 'PSE or DSO',
        validity_months: null,
        verification_url: null,
      },
    ],
    market_notes: {
      key_hubs: ['Warsaw', 'Kraków', 'Poznań'],
      grid_congestion_risk: 'low',
      renewable_curtailment_common: false,
      data_center_specific_rules: 'Emerging market with good grid availability. Competitive power prices. Growing hyperscale interest.',
      recent_regulatory_changes: 'Capacity market operational. Grid investment plans support new large loads.',
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // NORDICS
  // ──────────────────────────────────────────────────────────────────────────
  NO: {
    country_code: 'NO',
    country_name: 'Norway',
    country_name_local: 'Norge',
    allowed_domains: [
      'nve.no',                   // Norwegian Water Resources and Energy Directorate
      'statnett.no',              // TSO
      'regjeringen.no',           // Government
      'lovdata.no',               // Legislation
    ],
    energy_regulator: {
      name: 'Norges vassdrags- og energidirektorat (NVE)',
      website: 'https://www.nve.no',
      role: 'Water resources and energy directorate',
    },
    tso: [{
      name: 'Statnett',
      website: 'https://www.statnett.no',
      coverage: 'National transmission grid',
    }],
    dso: [],
    government_energy: {
      name: 'Olje- og energidepartementet',
      website: 'https://www.regjeringen.no/no/dep/oed',
    },
    planning_authority: {
      name: 'Kommune',
      website: null,
      notes: 'Building applications to municipality. Industrial installations may need NVE concession.',
    },
    connection_process: {
      typical_timeline_months: {
        application_to_offer: 3,
        offer_to_agreement: 2,
        agreement_to_energization: 18,
      },
      queue_rules: [
        {
          rule_type: 'first_come_first_served',
          description: 'Some regional capacity constraints',
          typical_timeline_months: null,
          penalty_for_miss: null,
        },
      ],
      firmness_options: ['firm'],
      flex_mechanism_name: null,
    },
    artefacts: [
      {
        id: 'no_tilknytningsavtale',
        name: 'Connection Agreement',
        name_local: 'Tilknytningsavtale',
        description: 'Agreement for grid connection',
        required_for: ['power_title', 'firmness'],
        typical_issuer: 'Statnett or regional grid company',
        validity_months: null,
        verification_url: null,
      },
    ],
    market_notes: {
      key_hubs: ['Oslo', 'Bergen', 'Stavanger'],
      grid_congestion_risk: 'low',
      renewable_curtailment_common: false,
      data_center_specific_rules: 'Attractive for green data centers due to hydro power. Cool climate reduces cooling costs.',
      recent_regulatory_changes: 'Some discussion of data center taxation. Generally supportive environment.',
    },
  },

  SE: {
    country_code: 'SE',
    country_name: 'Sweden',
    country_name_local: 'Sverige',
    allowed_domains: [
      'ei.se',                    // Swedish Energy Markets Inspectorate
      'svk.se',                   // Svenska Kraftnät (TSO)
      'vattenfall.se',            // Major utility
      'government.se',            // Government
      'riksdagen.se',             // Parliament/legislation
    ],
    energy_regulator: {
      name: 'Energimarknadsinspektionen (Ei)',
      website: 'https://www.ei.se',
      role: 'Energy Markets Inspectorate',
    },
    tso: [{
      name: 'Svenska Kraftnät',
      website: 'https://www.svk.se',
      coverage: 'National transmission grid',
    }],
    dso: [],
    government_energy: {
      name: 'Energimyndigheten',
      website: 'https://www.energimyndigheten.se',
    },
    planning_authority: {
      name: 'Kommun / Länsstyrelse',
      website: null,
      notes: 'Building permit from municipality. Environmental permit may be required for large facilities.',
    },
    connection_process: {
      typical_timeline_months: {
        application_to_offer: 6,
        offer_to_agreement: 3,
        agreement_to_energization: 36,
      },
      queue_rules: [
        {
          rule_type: 'first_come_first_served',
          description: 'Capacity constraints in Stockholm region',
          typical_timeline_months: null,
          penalty_for_miss: null,
        },
      ],
      firmness_options: ['firm', 'non_firm'],
      flex_mechanism_name: 'Efterfrågeflexibilitet',
    },
    artefacts: [
      {
        id: 'se_anslutningsavtal',
        name: 'Connection Agreement',
        name_local: 'Anslutningsavtal',
        description: 'Grid connection agreement',
        required_for: ['power_title', 'firmness'],
        typical_issuer: 'Svenska Kraftnät or regional grid company',
        validity_months: null,
        verification_url: null,
      },
    ],
    market_notes: {
      key_hubs: ['Stockholm', 'Luleå (north)', 'Malmö'],
      grid_congestion_risk: 'medium',
      renewable_curtailment_common: false,
      data_center_specific_rules: 'Northern Sweden attractive for hyperscale (cheap power, cold climate). Stockholm region has capacity constraints.',
      recent_regulatory_changes: 'Grid capacity discussions ongoing. Focus on enabling electrification including data centers.',
    },
  },

  DK: {
    country_code: 'DK',
    country_name: 'Denmark',
    country_name_local: 'Danmark',
    allowed_domains: [
      'forsyningstilsynet.dk',    // Danish Utility Regulator
      'energinet.dk',             // TSO
      'ens.dk',                   // Danish Energy Agency
      'retsinformation.dk',       // Legislation
    ],
    energy_regulator: {
      name: 'Forsyningstilsynet',
      website: 'https://forsyningstilsynet.dk',
      role: 'Danish Utility Regulator',
    },
    tso: [{
      name: 'Energinet',
      website: 'https://energinet.dk',
      coverage: 'National transmission grid and gas',
    }],
    dso: [],
    government_energy: {
      name: 'Energistyrelsen',
      website: 'https://ens.dk',
    },
    planning_authority: {
      name: 'Kommune',
      website: null,
      notes: 'Building permit from municipality. Environmental approval may be needed.',
    },
    connection_process: {
      typical_timeline_months: {
        application_to_offer: 3,
        offer_to_agreement: 2,
        agreement_to_energization: 18,
      },
      queue_rules: [
        {
          rule_type: 'first_come_first_served',
          description: 'Generally good capacity availability',
          typical_timeline_months: null,
          penalty_for_miss: null,
        },
      ],
      firmness_options: ['firm'],
      flex_mechanism_name: 'Fleksibelt elforbrug',
    },
    artefacts: [
      {
        id: 'dk_tilslutningsaftale',
        name: 'Connection Agreement',
        name_local: 'Tilslutningsaftale',
        description: 'Agreement for grid connection',
        required_for: ['power_title', 'firmness'],
        typical_issuer: 'Energinet or local DSO',
        validity_months: null,
        verification_url: null,
      },
    ],
    market_notes: {
      key_hubs: ['Copenhagen', 'Odense'],
      grid_congestion_risk: 'low',
      renewable_curtailment_common: false,
      data_center_specific_rules: 'Apple, Google, Facebook have large facilities. Heat reuse to district heating common.',
      recent_regulatory_changes: 'Strong focus on heat reuse integration. Generally supportive data center policy.',
    },
  },

  FI: {
    country_code: 'FI',
    country_name: 'Finland',
    country_name_local: 'Suomi',
    allowed_domains: [
      'energiavirasto.fi',        // Energy Authority
      'fingrid.fi',               // TSO
      'tem.fi',                   // Ministry of Economic Affairs
      'finlex.fi',                // Legislation
    ],
    energy_regulator: {
      name: 'Energiavirasto',
      website: 'https://energiavirasto.fi',
      role: 'Energy Authority',
    },
    tso: [{
      name: 'Fingrid',
      website: 'https://www.fingrid.fi',
      coverage: 'National transmission grid',
    }],
    dso: [],
    government_energy: {
      name: 'Työ- ja elinkeinoministeriö',
      website: 'https://tem.fi',
    },
    planning_authority: {
      name: 'Kunta',
      website: null,
      notes: 'Building permit from municipality. Environmental permit may be required for large facilities.',
    },
    connection_process: {
      typical_timeline_months: {
        application_to_offer: 3,
        offer_to_agreement: 2,
        agreement_to_energization: 18,
      },
      queue_rules: [
        {
          rule_type: 'first_come_first_served',
          description: 'Good capacity availability in most regions',
          typical_timeline_months: null,
          penalty_for_miss: null,
        },
      ],
      firmness_options: ['firm'],
      flex_mechanism_name: 'Kulutusjousto',
    },
    artefacts: [
      {
        id: 'fi_liittymissopimus',
        name: 'Connection Agreement',
        name_local: 'Liittymissopimus',
        description: 'Grid connection agreement',
        required_for: ['power_title', 'firmness'],
        typical_issuer: 'Fingrid or local DSO',
        validity_months: null,
        verification_url: null,
      },
    ],
    market_notes: {
      key_hubs: ['Helsinki', 'Hamina (Google)'],
      grid_congestion_risk: 'low',
      renewable_curtailment_common: false,
      data_center_specific_rules: 'Google has major presence in Hamina. Good nuclear/renewable mix. Cold climate advantageous.',
      recent_regulatory_changes: 'Generally supportive environment. Focus on sustainability.',
    },
  },
};

// Helper function to get country pack
export function getCountryPack(countryCode: string): CountryPackDataType | null {
  return COUNTRY_PACKS[countryCode.toUpperCase()] || null;
}

// Get all country codes
export function getAllCountryCodes(): string[] {
  return Object.keys(COUNTRY_PACKS);
}

// Get allowed domains for a country
export function getAllowedDomainsForCountry(countryCode: string): string[] {
  const pack = getCountryPack(countryCode);
  return pack?.allowed_domains || [];
}
