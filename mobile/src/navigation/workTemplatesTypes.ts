export type WorkTemplatesStackParamList = {
  WorkTemplatesHome: undefined;
  WorkTemplateStations: { templateId: string; day: number };
  WorkTemplateStationCreate: {
    templateId: string;
    day: number;
    customerId?: string | null;
    workerId?: string | null;
    scheduledTime?: string;
  };
  WorkTemplateStationEdit: {
    templateId: string;
    day: number;
    stationId: string;
    customerId?: string | null;
    workerId?: string | null;
    scheduledTime?: string;
  };
  WorkTemplateUserPicker: {
    kind: 'customer' | 'worker';
    templateId: string;
    day: number;
    target: 'create' | 'edit';
    stationId?: string;
    currentId?: string | null;
  };
};

