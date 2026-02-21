export interface CircuitSector {
  name: string;
  start: number;
  end: number;
}

export interface Circuit {
  name: string;
  length: number;
  sectors: CircuitSector[];
}

export const CIRCUITS: Record<string, Circuit> = {
  imola: {
    name: "Autodromo Enzo e Dino Ferrari (Imola)",
    length: 4909,
    sectors: [
      { name: "Variante Tamburello", start: 450, end: 850 },
      { name: "Villeneuve", start: 1150, end: 1450 },
      { name: "Tosa", start: 1550, end: 1800 },
      { name: "Piratella", start: 2150, end: 2400 },
      { name: "Acque Minerali", start: 2400, end: 2950 },
      { name: "Variante Alta", start: 3150, end: 3500 },
      { name: "Rivazza 1 & 2", start: 3900, end: 4500 },
    ],
  },
};
