export type WorkTemplatesStackParamList = {
  WorkTemplatesHome: undefined;
  WorkTemplateStations: { templateId: string; day: number };
  WorkTemplateStationCreate: {
    templateId: string;
    day: number;
  };
  WorkTemplateStationEdit: {
    templateId: string;
    day: number;
    stationId: string;
  };
};

