import { iccDoctemplateApi } from "../icc-api/iccApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"
import {AttachmentDto, XHR} from "../..";
import * as models from "../icc-api/model/models";
import * as _ from "lodash";

export class IccDoctemplateXApi extends iccDoctemplateApi {
  crypto: IccCryptoXApi;

  constructor(host: string, headers: Array<XHR.Header>, crypto: IccCryptoXApi) {
    super(host, headers);
    this.crypto = crypto;
  }

  newInstance(user: models.UserDto, attachmentId : string, attachmentDto : AttachmentDto, documentType: string, c: any) {
    //TODO
    const document = _.extend(
      {
        id: this.crypto.randomUuid(),
        _type: "org.taktik.icure.entities.DocumentTemplate",
        created: new Date().getTime(),
        modified: new Date().getTime(),
        owner: user.id,
        codes: [],
        tags: [],
        name: "????",
        specialty: "????",
        attachments: "????",//AttachmentDto
      },
      c || {}
    );
  }

}
