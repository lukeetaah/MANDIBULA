export type EvidenceTag =
  "DOCUMENTADA" | "GENERAL" | "PLAUSIBLE" | "ABSTRACCIÓN" | "FICCIÓN";

export interface SpeciesProfile {
  id:
    | "acromyrmex-lobicornis"
    | "vespula-germanica"
    | "bombus-dahlbomii"
    | "porotermes-quadricollis";
  scientificName: string;
  commonRole: string;
  trophicMode: string;
  playableInSlice: boolean;
  strengths: readonly string[];
  riskResponse: readonly string[];
}

export const speciesProfiles: readonly SpeciesProfile[] = [
  {
    id: "acromyrmex-lobicornis",
    scientificName: "Acromyrmex lobicornis",
    commonRole: "fungicultora colectiva",
    trophicMode: "fungicultura a partir de sustrato vegetal",
    playableInSlice: true,
    strengths: [
      "saturación colectiva",
      "redes de rastro",
      "ingeniería del suelo",
    ],
    riskResponse: [
      "alarma química",
      "cambio de ruta",
      "ataque colectivo",
      "evacuación",
    ],
  },
  {
    id: "vespula-germanica",
    scientificName: "Vespula germanica",
    commonRole: "depredadora y carroñera invasora",
    trophicMode: "depredación generalista y carroñeo",
    playableInSlice: false,
    strengths: ["combate aéreo", "hostigamiento", "retirada vertical"],
    riskResponse: ["maniobra aérea", "ataque repetido", "cambio de corredor"],
  },
  {
    id: "bombus-dahlbomii",
    scientificName: "Bombus dahlbomii",
    commonRole: "polinizadora nativa",
    trophicMode: "néctar y polen",
    playableInSlice: false,
    strengths: ["detección aérea", "memoria floral", "evasión"],
    riskResponse: ["abandono de circuito", "cambio de altura", "vuelo evasivo"],
  },
  {
    id: "porotermes-quadricollis",
    scientificName: "Porotermes quadricollis",
    commonRole: "termita de madera húmeda",
    trophicMode: "xilofagia y detritivoría",
    playableInSlice: false,
    strengths: ["sellado", "cuellos de botella", "protección estructural"],
    riskResponse: ["repliegue", "barreras", "traslado de crías"],
  },
] as const;

export const evidence = {
  fungusCultivation: "DOCUMENTADA",
  temperatureDrivenForaging: "DOCUMENTADA",
  pheromoneOrders: "ABSTRACCIÓN",
  interspeciesTruce: "ABSTRACCIÓN",
  spiderSatiation: "GENERAL",
  termiteControlledCollapse: "ABSTRACCIÓN",
  bumblebeePredatorMemory: "PLAUSIBLE",
} as const satisfies Record<string, EvidenceTag>;
