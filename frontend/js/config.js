// Endereços dos serviços e rótulos fixos.

// O catálogo (FastAPI) serve esta página, então fica no mesmo endereço.
// A comunidade (Spring Boot) roda na porta 8080 do mesmo computador.
// Como o site usa módulos ES, ele precisa ser aberto pelo servidor (http://), não direto do disco.
export const CATALOG_API = "";

export const SOCIAL_API = `${location.protocol}//${location.hostname}:8080`;

export const STATUS_LABEL = {
  JOGANDO: "Jogando",
  JOGADO: "Jogado",
  ZERADO: "Zerado",
  PLATINADO: "Platinado",
  ABANDONADO: "Abandonado",
};
