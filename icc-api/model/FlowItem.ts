export class FlowItem {
  constructor(json: JSON | any) {
    Object.assign(this as FlowItem, json);
  }

  id?: string;

  title?: string;

  comment?: string;

  receptionDate?: number;

  processingDate?: number;

  processer?: string;

  cancellationDate?: number;

  canceller?: string;

  cancellationReason?: string;

  cancellationNote?: string;

  status?: string;

  homeVisit?: boolean;

  municipality?: string;

  town?: string;

  zipCode?: string;

  street?: string;

  building?: string;

  buildingNumber?: string;

  doorbellName?: string;

  floor?: string;

  letterBox?: string;

  notesOps?: string;

  notesContact?: string;

  latitude?: string;

  longitude?: string;

  type?: string;

  emergency?: boolean;

  phoneNumber?: string;

  patientId?: string;

  patientLastName?: string;

  patientFirstName?: string;

}
