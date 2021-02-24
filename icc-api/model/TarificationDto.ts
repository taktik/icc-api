/**
 * 
 * No description provided (generated by Swagger Codegen https://github.com/swagger-api/swagger-codegen)
 *
 * OpenAPI spec version: 1.0.2
 * 
 *
 * NOTE: This class is auto generated by the swagger code generator program.
 * https://github.com/swagger-api/swagger-codegen.git
 * Do not edit the class manually.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as models from "./models"

export class TarificationDto  {
  constructor(json: JSON | any) {
    Object.assign(this as TarificationDto, json)
  }
  id?: string

  rev?: string

  deletionDate?: number

  parent?: string

  author?: string

  regions?: Array<string>

  type?: string

  version?: string

  code?: string

  level?: number

  label?: { [key: string]: string }

  searchTerms?: { [key: string]: Array<string> }

  links?: Array<string>

  qualifiedLinks?: { [key: string]: Array<string> }

  flags?: Array<TarificationDto.FlagsEnum>

  data?: string

  appendices?: { [key: string]: string }

  periodicity?: Array<models.Periodicity>

  disabled?: boolean

  valorisations?: Array<models.ValorisationDto>

  category?: { [key: string]: string }

  consultationCode?: boolean

  hasRelatedCode?: boolean

  needsPrescriber?: boolean

  relatedCodes?: Array<string>

  getnGroup?: string

  letterValues?: Array<models.LetterValue>
}
export namespace TarificationDto {
  export enum FlagsEnum {
    MaleOnly = <any>"male_only",
    FemaleOnly = <any>"female_only",
    Deptkinesitherapy = <any>"deptkinesitherapy",
    Deptnursing = <any>"deptnursing",
    Deptgeneralpractice = <any>"deptgeneralpractice",
    Deptsocialworker = <any>"deptsocialworker",
    Deptpsychology = <any>"deptpsychology",
    Deptadministrative = <any>"deptadministrative",
    Deptdietetics = <any>"deptdietetics",
    Deptspeechtherapy = <any>"deptspeechtherapy",
    Deptdentistry = <any>"deptdentistry",
    Deptoccupationaltherapy = <any>"deptoccupationaltherapy",
    Depthealthcare = <any>"depthealthcare",
    Deptgynecology = <any>"deptgynecology",
    Deptpediatry = <any>"deptpediatry",
    Deptalgology = <any>"deptalgology",
    Deptanatomopathology = <any>"deptanatomopathology",
    Deptanesthesiology = <any>"deptanesthesiology",
    Deptbacteriology = <any>"deptbacteriology",
    Deptcardiacsurgery = <any>"deptcardiacsurgery",
    Deptcardiology = <any>"deptcardiology",
    Deptchildandadolescentpsychiatry = <any>"deptchildandadolescentpsychiatry",
    Deptdermatology = <any>"deptdermatology",
    Deptdiabetology = <any>"deptdiabetology",
    Deptemergency = <any>"deptemergency",
    Deptendocrinology = <any>"deptendocrinology",
    Deptgastroenterology = <any>"deptgastroenterology",
    Deptgenetics = <any>"deptgenetics",
    Deptgeriatry = <any>"deptgeriatry",
    Depthandsurgery = <any>"depthandsurgery",
    Depthematology = <any>"depthematology",
    Deptinfectiousdisease = <any>"deptinfectiousdisease",
    Deptintensivecare = <any>"deptintensivecare",
    Deptlaboratory = <any>"deptlaboratory",
    Deptmajorburns = <any>"deptmajorburns",
    Deptmaxillofacialsurgery = <any>"deptmaxillofacialsurgery",
    Deptmedicine = <any>"deptmedicine",
    Deptmolecularbiology = <any>"deptmolecularbiology",
    Deptneonatalogy = <any>"deptneonatalogy",
    Deptnephrology = <any>"deptnephrology",
    Deptneurology = <any>"deptneurology",
    Deptneurosurgery = <any>"deptneurosurgery",
    Deptnte = <any>"deptnte",
    Deptnuclear = <any>"deptnuclear",
    Deptnutritiondietetics = <any>"deptnutritiondietetics",
    Deptobstetrics = <any>"deptobstetrics",
    Deptoncology = <any>"deptoncology",
    Deptophtalmology = <any>"deptophtalmology",
    Deptorthopedy = <any>"deptorthopedy",
    Deptpalliativecare = <any>"deptpalliativecare",
    Deptpediatricintensivecare = <any>"deptpediatricintensivecare",
    Deptpediatricsurgery = <any>"deptpediatricsurgery",
    Deptpharmacy = <any>"deptpharmacy",
    Deptphysicalmedecine = <any>"deptphysicalmedecine",
    Deptphysiotherapy = <any>"deptphysiotherapy",
    Deptplasticandreparatorysurgery = <any>"deptplasticandreparatorysurgery",
    Deptpneumology = <any>"deptpneumology",
    Deptpodiatry = <any>"deptpodiatry",
    Deptpsychiatry = <any>"deptpsychiatry",
    Deptradiology = <any>"deptradiology",
    Deptradiotherapy = <any>"deptradiotherapy",
    Deptrevalidation = <any>"deptrevalidation",
    Deptrheumatology = <any>"deptrheumatology",
    Deptrhumatology = <any>"deptrhumatology",
    Deptsenology = <any>"deptsenology",
    Deptsocialservice = <any>"deptsocialservice",
    Deptsportsmedecine = <any>"deptsportsmedecine",
    Deptstomatology = <any>"deptstomatology",
    Deptsurgery = <any>"deptsurgery",
    Deptthoracicsurgery = <any>"deptthoracicsurgery",
    Depttoxicology = <any>"depttoxicology",
    Depttropicalmedecine = <any>"depttropicalmedecine",
    Depturology = <any>"depturology",
    Deptvascularsurgery = <any>"deptvascularsurgery",
    Deptvisceraldigestiveabdominalsurgery = <any>"deptvisceraldigestiveabdominalsurgery",
    Depttransplantsurgery = <any>"depttransplantsurgery",
    Deptpercutaneous = <any>"deptpercutaneous",
    Deptchildbirth = <any>"deptchildbirth"
  }
}
