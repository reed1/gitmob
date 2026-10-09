/** A model and effort of the session's provider, picked from `claudex models`. */
export interface CustomModel {
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
