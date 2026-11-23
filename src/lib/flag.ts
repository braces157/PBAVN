const ISO2_BY_CODE: Record<string, string> = {
  KOR: "kr",
  ESP: "es",
  VIE: "vn", VNM: "vn",
  TUR: "tr",
  BEL: "be",
  GRE: "gr", GRC: "gr",
  COL: "co",
  NED: "nl", NLD: "nl",
  JPN: "jp",
  AUT: "at",
  FRA: "fr",
  GER: "de", DEU: "de",
  USA: "us",
  DEN: "dk", DNK: "dk",
  EGY: "eg",
  ITA: "it",
  POR: "pt", PRT: "pt",
  SWE: "se",
  MEX: "mx",
  CHN: "cn",
  ECU: "ec",
  PER: "pe",
  CAM: "kh", KHM: "kh",
  GBR: "gb", UK: "gb",
  TPE: "tw", TWN: "tw",
  BRA: "br",
  ARG: "ar",
  SUI: "ch", CHE: "ch",
  POL: "pl",
  CZE: "cz",
  ROU: "ro",
  HUN: "hu",
  THA: "th",
  MAS: "my", MYS: "my",
  PHI: "ph", PHL: "ph",
  AUS: "au",
  CAN: "ca",
};

export function flagClass(nation: string | null | undefined): string {
  const key = (nation ?? "").trim().toUpperCase();
  if (!key || key === "—") return "f";
  const iso2 = ISO2_BY_CODE[key] ?? (/^[A-Z]{2}$/.test(key) ? key.toLowerCase() : null);
  return iso2 ? `f fi fi-${iso2}` : "f";
}
