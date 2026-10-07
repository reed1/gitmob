export interface CustomModel {
  provider: string;
  model: string;
  effort: string;
}

export interface ModelCatalog {
  providers: {
    id: string;
    label: string;
    models: { id: string; label: string }[];
  }[];
  efforts: string[];
}
