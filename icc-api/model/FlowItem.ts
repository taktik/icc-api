export class FlowItem {
  constructor(json: JSON | any) {
    Object.assign(this as FlowItem, json);
  }

  id?: string;

  title?: string;

  receptionDate?: number;

  cancellationDate?: number;

  canceller?: string;

  processingDate?: number;

  processer?: string;

  phoneNumber?: string;

  patientId?: string;

  patientFirstName?: string;

  patientLastName?: string;

  status?: string;

  type?: string;

  emergency?: boolean;

  cancellationReason?: string;

  cancellationNote?: string;
}
