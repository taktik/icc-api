import { EfactMessage } from "fhc-api"
import { ErrorDetail } from "fhc-api"
import { Record } from "fhc-api"

export interface Zone200Data extends ETData {
  isTest: boolean
  hcpMessageRef: string
  mutualityMessageReference: string
}

export interface Zone300Data extends ETData {
  sendingNumber: string
  invoiceReference: string
  mutualityContactLastName: string
  mutualityContactFirstName: string
  mutualityContactPhoneNumber: string
  invoiceType: string
  invoiceMode: string
  errorPercentage: string
  invoiceRejectionType: string
}

export interface Zone300Short extends ETData {
  sendingNumber: string
  invoiceReference: string
  mutualityContactLastName: string
  mutualityContactFirstName: string
  mutualityContactPhoneNumber: string
  invoiceType: string
  invoiceMode: string
}

export interface Zone300Stub extends ETData {
  messageType: string
}

export interface Zone400Data {
  mutualityNumber: string
  signAmount1: string
  askedAmount1: string
  mutualityControlNumber: string
}

export interface Zone500Data {
  mutualityNumber: string
  signAmount1: string
  askedAmount1: string
  mutualityControlNumber: string
}

export interface ETData {
  errorDetail?: ErrorDetail
}

export interface ET10Data extends ETData {
  fileVersion: string
  financialAccountNumber1: string
  sendingNumber: string
  financialAccountNumber2: string
  deletionCodePaperInvoice: string
  thirdPartyNumber: string
  accreditationCinNumber: string
  invoicingYear: string
  invoicingMonth: string
  invoiceReference: string
  bic1: string
  iban1: string
  bic2: string
  iban2: string
  recordControlNumber: string
}

export interface ET20Data extends ETData {
  ct1ct2: string
  reference: string
  recipientIdentifierFlag: string
  previousInvoicingYearMonth: string
  insurabilityStartDate: string
  insurabilityEndDate: string
}

export interface ET50Data extends ETData {
  recordOrderNumber: string
  sex: string
  montantInterventionAssurance: string
  units: string
  prescriberNihii: string
  itemReference: string
  tooth: string
  thirdPartyException: string
  treatedMember: string
}

export interface ET51Data extends ETData {
  recordOrderNumber: string
  prestationCode: string
  prestationDate: string
  recipientIdentifier: string
  careProviderIdentifier: string
  reimbursementAmount: string
  ct1ct2: string
  networkReferenceData: string
  infoCommunicationDate: string
  recordControlNumber: string
}

export interface ET52Data extends ETData {
  recordOrderNumber: string
  nomenCode: string
  prestationDate: string
  eidDate: string
  patientINSS: string
  eidSupportType: string
  eidReadingType: string
  eidReadingHour: string
  nihii: string
}

export interface ET80Data extends ETData {
  recipientIdentifier: string
}

export interface ET90Data extends ETData {
  financialAccountNumber1: string
  sendingNumber: string
  financialAccountNumber2: string
  thirdPartyNumber: string
  signeAndTotalAmountCptA: string
  invoicingYear: string
  invoicingMonth: string
  invoiceReference: string
  cbe: string
  bic1: string
  iban1: string
  bic2: string
  iban2: string
  invoiceControlNumber: string
  recordControlNumber: string
}

export interface ET91Data {
  askedAmountForAccount1: string
  askedAmountForAccount2: string
  totalAskedAmount: string
  numberOfRecordBundle: string
  acceptedAmountAccount1: string
  rejectedAmountAccount1: string
  acceptedAmountAccount2: string
  rejectedAmountAccount2: string
  totalAcceptedAmount: string
  totalRejectedAmount: string
  paymentReferenceAccount1: string
  paymentReferenceAccount2: string
}

export interface ET92Data {
  askedAmountAccount1: string
  askedAmountAccount2: string
  totalAskedAmount: string
  numberOfRecord: string
  acceptedAmountAccount1: string
  rejectedAmountAccount1: string
  acceptedAmountAccount2: string
  rejectedAmountAccount2: string
  totalAcceptedAmount: string
  totalRejectedAmount: string
}

export interface ET20_80Data {
  et20: ET20Data
  items: Array<{
    et50?: ET50Data | undefined
    et51?: ET51Data | undefined
    et52?: ET52Data | undefined
  }>
  et80?: ET80Data
}

export interface File920900Data {
  zone200: Zone200Data
  zone300: Zone300Data
  et10: ET10Data
  records: Array<ET20_80Data>
  et90: ET90Data
  et91: Array<ET91Data>
  et92: ET92Data
}

export interface File931000Data {
  zone200: Zone200Data
}

export interface File920099Data {
  zone200: Zone200Data
  zone300: Zone300Data
  et10: ET10Data
  records: Array<ET20_80Data>
  et90: ET90Data
}

export interface File920098Data {
  zone200: Zone200Data
  zone300: Zone300Data
  et10: ET10Data
  records: Array<ET20_80Data>
  et90: ET90Data
}

export interface File920999Data {
  zone200: Zone200Data
  zone300: Zone300Short
  et95: Array<Zone400Data | undefined>
  et96: Zone500Data | undefined
}

export abstract class EfactMessageReader {
  message: EfactMessage
  abstract fileType: string
  private log: Function = (m: string, x: any) => {
    return x
  }

  constructor(message: EfactMessage, debug: boolean = false) {
    if (!message) {
      throw new Error("EfactMessageReader cannot be initialized to " + message)
    }
    this.message = message
    if (debug) {
      this.log = console.log
    }
  }

  get xades(): string | undefined {
    return this.message.xades
  }

  get hashValue() {
    return this.message.hashValue
  }

  abstract read(): any

  readZone200(zone200: Record): Zone200Data {
    let i = 0
    this.log("responseType", zone200.zones!![i].value)
    this.fileType = zone200.zones!![i].value
    i++
    this.log("errorCode", zone200.zones!![i++].value)
    this.log("N version format message premiere version 01", zone200.zones!![i++].value)
    this.log("errorCode", zone200.zones!![i++].value)
    this.log("Type message 12 prod/92 test", zone200.zones!![i].value)
    const testMessage: boolean = zone200.zones!![i].value === "92"
    i++
    this.log("Code erreur", zone200.zones!![i++].value)
    this.log("Statut message = code erreur si erreur !! IN - OUT !!", zone200.zones!![i++].value)
    this.log("Code erreur", zone200.zones!![i++].value)
    const healthcarePartyMessageReferenceNumber = this.log(
      "Reference numerique message prestataire",
      zone200.zones!![i++].value
    )

    this.log("Code erreur", zone200.zones!![i++].value)
    const oaMessageReference = this.log("Reference message OA", zone200.zones!![i++].value)

    this.log("Code erreur", zone200.zones!![i++].value)
    this.log("reserve", zone200.zones!![i++].value)
    if (zone200.zones!!.length !== i) {
      throw Error("Zone 200: The parsing is not matching the available number of zones.")
    }

    return {
      errorDetail: zone200.errorDetail,
      isTest: testMessage,
      hcpMessageRef: healthcarePartyMessageReferenceNumber,
      mutualityMessageReference: oaMessageReference
    }
  }

  readZone300(zone300: Record): Zone300Data {
    let i = 0
    this.log("Lien T10 Z22&23 Annee et mois facturation", zone300.zones!![i++].value)
    this.log("Code erreur", zone300.zones!![i++].value)
    const sendingNumber = this.log("Numro d'envoi", zone300.zones!![i++].value)

    this.log("Code erreur", zone300.zones!![i++].value)
    this.log("Lien T10 Z25 Date cration facture", zone300.zones!![i++].value)
    this.log("Code erreur", zone300.zones!![i++].value)
    const invoiceReference = this.log("Reference facture", zone300.zones!![i++].value)

    this.log("Code erreur", zone300.zones!![i++].value)
    this.log("Lien T10 Z4 Numro version instructions", zone300.zones!![i++].value)
    this.log("Code erreur", zone300.zones!![i++].value)
    const oaContactLastName = this.log("Nom personne contact OA", zone300.zones!![i++].value)

    this.log("Code erreur", zone300.zones!![i++].value)
    const oaContactFirstName = this.log("Prnom personne de contact OA", zone300.zones!![i++].value)

    this.log("Code erreur", zone300.zones!![i++].value)
    const oaContactPhoneNumber = this.log(
      "Numro telephone personne contact OA",
      zone300.zones!![i++].value
    )

    this.log("Code erreur", zone300.zones!![i++].value)
    const invoiceType = this.log("Type de facture", zone300.zones!![i++].value)

    this.log("Code erreur", zone300.zones!![i++].value)
    const invoiceMode = this.log("Mode facturation", zone300.zones!![i++].value)

    this.log("Code erreur", zone300.zones!![i++].value)
    const errorPercentage = this.log("Pourcentage erreurs", zone300.zones!![i++].value)

    this.log("Code erreur", zone300.zones!![i++].value)
    const invoiceRejectionType = this.log("Type refus facturation", zone300.zones!![i++].value)

    this.log("Code erreur", zone300.zones!![i++].value)
    this.log("reserve", zone300.zones!![i++].value)
    if (zone300.zones!!.length !== i) {
      throw Error("Zone 300: The parsing is not matching the available number of zones.")
    }

    return {
      errorDetail: zone300.errorDetail,
      sendingNumber: sendingNumber,
      invoiceReference: invoiceReference,
      mutualityContactLastName: oaContactLastName,
      mutualityContactFirstName: oaContactFirstName,
      mutualityContactPhoneNumber: oaContactPhoneNumber,
      invoiceType: invoiceType,
      invoiceMode: invoiceMode,
      errorPercentage: errorPercentage,
      invoiceRejectionType: invoiceRejectionType
    }
  }

  readZone300Stub(zone300: Record): Zone300Stub {
    let i = 0
    const messageType = this.log(
      "Nom du message visé par cette communication",
      zone300.zones!![i++].value
    )

    this.log("Code erreur", zone300.zones!![i++].value)
    this.log("reserve", zone300.zones!![i++].value)
    if (zone300.zones!!.length !== i) {
      throw Error("Zone 300: The parsing is not matching the available number of zones.")
    }

    return {
      messageType
    }
  }

  readZone300Short(zone300: Record): Zone300Short {
    let i = 0
    this.log("Lien T10 Z22&23 Annee et mois facturation", zone300.zones!![i++].value)
    this.log("Code erreur", zone300.zones!![i++].value)
    const sendingNumber = this.log("Numro d'envoi", zone300.zones!![i++].value)

    this.log("Code erreur", zone300.zones!![i++].value)
    this.log("Lien T10 Z25 Date cration facture", zone300.zones!![i++].value)
    this.log("Code erreur", zone300.zones!![i++].value)
    const invoiceReference = this.log("Reference facture", zone300.zones!![i++].value)

    this.log("Code erreur", zone300.zones!![i++].value)
    this.log("Lien T10 Z4 Numro version instructions", zone300.zones!![i++].value)
    this.log("Code erreur", zone300.zones!![i++].value)
    const oaContactLastName = this.log("Nom personne contact OA", zone300.zones!![i++].value)

    this.log("Code erreur", zone300.zones!![i++].value)
    const oaContactFirstName = this.log("Prnom personne de contact OA", zone300.zones!![i++].value)

    this.log("Code erreur", zone300.zones!![i++].value)
    const oaContactPhoneNumber = this.log(
      "Numro telephone personne contact OA",
      zone300.zones!![i++].value
    )

    this.log("Code erreur", zone300.zones!![i++].value)
    const invoiceType = this.log("Type de facture", zone300.zones!![i++].value)

    this.log("Code erreur", zone300.zones!![i++].value)
    const invoiceMode = this.log("Mode facturation", zone300.zones!![i++].value)

    this.log("Code erreur", zone300.zones!![i++].value)
    this.log("reserve", zone300.zones!![i++].value)
    if (zone300.zones!!.length !== i) {
      throw Error("Zone 300: The parsing is not matching the available number of zones.")
    }

    return {
      errorDetail: zone300.errorDetail,
      sendingNumber: sendingNumber,
      invoiceReference: invoiceReference,
      mutualityContactLastName: oaContactLastName,
      mutualityContactFirstName: oaContactFirstName,
      mutualityContactPhoneNumber: oaContactPhoneNumber,
      invoiceType: invoiceType,
      invoiceMode: invoiceMode
    }
  }

  readET10(et10: Record): ET10Data {
    const etNumber = 10
    let i = 0
    this.log("EnregistrementType", et10.zones!![i].value)
    if (et10.zones!![i].value !== etNumber.toString()) {
      throw new Error(
        `Trying to parse an ET${etNumber} that is not an ET${etNumber} --- ${JSON.stringify(et10)}`
      )
    }
    i++
    this.log("NumeroOrdreEnregistrement", et10.zones!![i++].value)
    this.log("NombreNumerosComptesFinanciers", et10.zones!![i++].value)
    const fileVersion = this.log("VersionFichier", et10.zones!![i++].value)

    const financialAccountNumber1 = this.log(
      "NumeroCompteFinancierAPartie1et2",
      et10.zones!![i++].value
    )

    this.log("Reserve", et10.zones!![i++].value)
    const sendingNumber = this.log("NumeroDeLenvoi", et10.zones!![i++].value)

    const financialAccountNumber2 = this.log("NumeroCompteFinancierB", et10.zones!![i++].value)

    this.log("Reserve", et10.zones!![i++].value)
    const deletionCodePaperInvoice = this.log(
      "CodeSuppressionFacturePapier",
      et10.zones!![i++].value
    )

    this.log("CodeFichierDeDecompte", et10.zones!![i++].value)
    this.log("Reserve", et10.zones!![i++].value)
    this.log("Reserve", et10.zones!![i++].value)
    this.log("ContenuDeLaFacturation", et10.zones!![i++].value)
    const thirdPartyNumber = this.log("NumeroTiersPayant", et10.zones!![i++].value)

    const accreditationCinNumber = this.log("NumeroDaccreditationCin", et10.zones!![i++].value)

    this.log("Reserve", et10.zones!![i++].value)
    this.log("Reserve", et10.zones!![i++].value)
    this.log("Reserve", et10.zones!![i++].value)
    this.log("Reserve", et10.zones!![i++].value)
    this.log("Reserve", et10.zones!![i++].value)
    this.log("Reserve", et10.zones!![i++].value)
    const invoicingYear = this.log("AnneeDeFacturation", et10.zones!![i++].value)

    const invoicingMonth = this.log("MoisDeFacturation", et10.zones!![i++].value)

    this.log("Reserve", et10.zones!![i++].value)
    this.log("DateDeCreationPartie1et2", et10.zones!![i++].value)
    this.log("BCE", et10.zones!![i++].value)
    const invoiceReference = this.log("ReferenceDeLetablissement", et10.zones!![i++].value)

    this.log("Reserve", et10.zones!![i++].value)
    this.log("Reserve", et10.zones!![i++].value)
    const bic1 = this.log("BicCompteFinancierAPartie1_2_3et4", et10.zones!![i++].value)

    this.log("Reserve", et10.zones!![i++].value)
    const iban1 = this.log("IbanCompteFinancierAPartie1_2_3_4_5et6", et10.zones!![i++].value)

    this.log("Reserve", et10.zones!![i++].value)
    const bic2 = this.log("BicCompteFinancierB", et10.zones!![i++].value)

    this.log("Reserve", et10.zones!![i++].value)
    this.log("Reserve", et10.zones!![i++].value)
    this.log("Reserve", et10.zones!![i++].value)
    this.log("Reserve", et10.zones!![i++].value)
    this.log("Reserve", et10.zones!![i++].value)
    this.log("Reserve", et10.zones!![i++].value)
    const iban2 = this.log("IbanCompteFinancierBPartie1_2_3et4", et10.zones!![i++].value)

    this.log("Reserve", et10.zones!![i++].value)
    this.log("Reserve", et10.zones!![i++].value)
    this.log("Reserve", et10.zones!![i++].value)
    this.log("Reserve", et10.zones!![i++].value)
    this.log("Reserve", et10.zones!![i++].value)
    this.log("Reserve", et10.zones!![i++].value)
    this.log("Reserve", et10.zones!![i++].value)
    this.log("Reserve", et10.zones!![i++].value)
    const recordControlNumber = this.log(
      "Chiffres de controle de l'enregistrement",
      et10.zones!![i++].value
    )

    if (i !== et10.zones!!.length) {
      throw new Error(`You didn\'t parse every zones of the ET${etNumber}`)
    }

    return {
      errorDetail: et10.errorDetail,
      fileVersion,
      financialAccountNumber1,
      sendingNumber,
      financialAccountNumber2,
      deletionCodePaperInvoice,
      thirdPartyNumber,
      accreditationCinNumber,
      invoicingYear,
      invoicingMonth,
      invoiceReference,
      bic1,
      iban1,
      bic2,
      iban2,
      recordControlNumber
    }
  }

  readET20(et20: Record): ET20Data {
    const etNumber = 20
    let i = 0
    this.log("EnregistrementDeType20", et20.zones!![i].value)
    if (et20.zones!![i].value !== etNumber.toString()) {
      throw new Error(
        `Trying to parse an ET${etNumber} that is not an ET${etNumber} --- ${JSON.stringify(et20)}`
      )
    }
    i++
    this.log("NumeroDordreDeLenregistrement", et20.zones!![i++].value)
    this.log("AutorisationTiersPayant", et20.zones!![i++].value)
    this.log("HeureDadmission", et20.zones!![i++].value)
    this.log("DateDadmission", et20.zones!![i++].value)
    this.log("DateDeSortiePartie1", et20.zones!![i++].value)
    this.log("DateDeSortiePartie2", et20.zones!![i++].value)
    this.log("NumeroMutualiteDaffiliation", et20.zones!![i++].value)
    this.log("IdentificationBeneficiairePartie1et2", et20.zones!![i++].value)
    this.log("SexeBeneficiaire", et20.zones!![i++].value)
    this.log("TypeFacture", et20.zones!![i++].value)
    this.log("TypeDeFacturation", et20.zones!![i++].value)
    this.log("Reserve", et20.zones!![i++].value)
    this.log("Service721Bis", et20.zones!![i++].value)
    this.log("NumeroDeLetablissementQuiFacture", et20.zones!![i++].value)
    this.log("EtablissementDeSejour", et20.zones!![i++].value)
    this.log("CodeLeveeDelaiDePrescription", et20.zones!![i++].value)
    this.log("CausesDuTraitement", et20.zones!![i++].value)
    this.log("NumeroMutualiteDeDestination", et20.zones!![i++].value)
    this.log("NumeroDadmission", et20.zones!![i++].value)
    this.log("DateAccordTraitementPartie1et2", et20.zones!![i++].value)
    this.log("HeureDeSortie", et20.zones!![i++].value)
    this.log("Reserve", et20.zones!![i++].value)
    this.log("NumeroDeLaFactureIndividuellePartie1et2", et20.zones!![i++].value)
    this.log("ApplicationFranchiseSociale", et20.zones!![i++].value)
    const ct1ct2 = this.log("Ct1Ct2", et20.zones!![i++].value)

    const reference = this.log("ReferenceDeLetablissement", et20.zones!![i++].value)

    this.log("NumeroDeFacturePrecedentePartie1_2et3", et20.zones!![i++].value)
    const recipientIdentifierFlag = this.log(
      "FlagIdentificationDuBeneficiaire",
      et20.zones!![i++].value
    )

    this.log("Reserve", et20.zones!![i++].value)
    this.log("NumeroEnvoiPrecedentPartie1_2et3", et20.zones!![i++].value)
    this.log("NumeroMutualiteFacturationPrecedente", et20.zones!![i++].value)
    this.log("Reserve", et20.zones!![i++].value)
    const previousInvoicingYearMonth = this.log(
      "AnneeEtMoisDeFacturationPrecedente",
      et20.zones!![i++].value
    )

    i++
    this.log("DonneesDeReferenceReseauOuCarteSisPartie1_2_3_4et5", et20.zones!![i++].value)
    this.log("Reserve", et20.zones!![i++].value)
    this.log("Date de facturation", et20.zones!![i++].value)
    this.log("Reserve", et20.zones!![i++].value)
    i++
    this.log("ReferenceMutualiteNumeroCompteFinancierBPartie1_2et3", et20.zones!![i++].value)
    this.log("Reserve", et20.zones!![i++].value)
    const insurabilityStartDate = this.log("DateDebutAssurabilite", et20.zones!![i++].value)

    const insurabilityEndDate = this.log("DateFinAssurabilite", et20.zones!![i++].value)

    this.log("DateCommunicationInformation", et20.zones!![i++].value)
    this.log("MafAnneeEnCours", et20.zones!![i++].value)
    this.log("MafAnneeEnCours2", et20.zones!![i++].value)
    this.log("Reserve", et20.zones!![i++].value)
    this.log("Reserve", et20.zones!![i++].value)
    this.log("Chiffres de controle de l'enregistrement", et20.zones!![i++].value)
    if (i !== et20.zones!!.length) {
      throw new Error(`You didn\'t parse every zones of the ET${etNumber}`)
    }
    return {
      errorDetail: et20.errorDetail,
      ct1ct2,
      reference,
      recipientIdentifierFlag,
      previousInvoicingYearMonth,
      insurabilityStartDate,
      insurabilityEndDate
    }
  }

  readET50(et50: Record): ET50Data {
    const etNumber = 50
    let i = 0
    this.log("EnregistrementDeType50", et50.zones!![i].value)
    if (et50.zones!![i].value !== etNumber.toString()) {
      throw new Error(
        `Trying to parse an ET${etNumber} that is not an ET${etNumber} --- ${JSON.stringify(et50)}`
      )
    }
    i++
    const recordOrderNumber = this.log("NumeroDordreDeLenregistrement", et50.zones!![i++].value)

    this.log("NormePrestationPourcentage", et50.zones!![i++].value)
    this.log("CodeNomenclatureOuPseudoCodeNomenclature", et50.zones!![i++].value)
    this.log("DatePremierePrestationEffectuee", et50.zones!![i++].value)
    this.log("DateDernierePrestationEffectueePartie1et2", et50.zones!![i++].value)
    this.log("NumeroMutualiteDaffiliation", et50.zones!![i++].value)
    this.log("IdentificationBeneficiairePartie1et2", et50.zones!![i++].value)
    const sex = this.log("SexeBeneficiaire", et50.zones!![i++].value)

    this.log("Accouchement", et50.zones!![i++].value)
    this.log("ReferenceNumeroDeCompteFinancier", et50.zones!![i++].value)
    this.log("NuitWeekEndJourFerie", et50.zones!![i++].value)
    this.log("CodeService", et50.zones!![i++].value)
    this.log("LieuDePrestation", et50.zones!![i++].value)
    this.log("IdentificationDuDispensateur", et50.zones!![i++].value)
    this.log("NormeDispensateur", et50.zones!![i++].value)
    this.log("PrestationRelativePartie1et2", et50.zones!![i++].value)
    const montantInterventionAssurance = this.log(
      "SigneMontantInterventionDeLassurance",
      et50.zones!![i++].value
    )
    this.log("DatePrescriptionPartie1et2", et50.zones!![i++].value)
    const units = this.log("SigneNombreDunites", et50.zones!![i++].value)

    this.log("NombreDeCoupes", et50.zones!![i++].value)
    const prescriberNihii = this.log(
      "IdentificationPrescripteurPartie1et2",
      et50.zones!![i++].value
    )

    this.log("NormePrescripteur", et50.zones!![i++].value)
    this.log("Z27SigneInterventionPersonnellePatient", et50.zones!![i++].value)
    const itemReference = this.log("ReferenceDeLetablissement", et50.zones!![i++].value)

    const tooth = this.log("DentTraitee", et50.zones!![i++].value)

    this.log("SigneMontantSupplementPartie1et2", et50.zones!![i++].value)
    const thirdPartyException = this.log("ExceptionTiersPayant", et50.zones!![i++].value)

    this.log("CodeFacturationInterventionPersonnelleOuSupplement", et50.zones!![i++].value)
    const treatedMember = this.log("MembreTraite", et50.zones!![i++].value)

    this.log("PrestataireConventionne", et50.zones!![i++].value)
    this.log("HeureDePrestationPartie1et2", et50.zones!![i++].value)
    this.log("IdentificationAdministrateurDuSang", et50.zones!![i++].value)
    this.log("NumeroDeLattestationDadministrationPartie1et2", et50.zones!![i++].value)
    this.log("NumeroBonDeDelivranceOuSacPartie1et2", et50.zones!![i++].value)
    this.log("CodeImplantPartie1", et50.zones!![i++].value)
    this.log("LibelleDuProduitPartie1et2", et50.zones!![i++].value)
    this.log("NormePlafond", et50.zones!![i++].value)
    this.log("DateAccordPrestation", et50.zones!![i++].value)
    this.log("Transplantation", et50.zones!![i++].value)
    this.log("identification de l'aide soignant", et50.zones!![i++].value)
    this.log("Reserve", et50.zones!![i++].value)
    this.log("SiteHospitalier", et50.zones!![i++].value)
    this.log("IdentificationAssociationBassinDeSoins", et50.zones!![i++].value)
    this.log("numero de course (partie 1 et 2)", et50.zones!![i++].value)
    this.log("Reserve", et50.zones!![i++].value)
    this.log("CodeNotificationImplantPartie1et2", et50.zones!![i++].value)
    this.log("code d'enregistrement Qermid (partie 1, 2 et 3)", et50.zones!![i++].value)
    this.log("Reserve", et50.zones!![i++].value)
    this.log("Chiffres de controle de l'enregistrement", et50.zones!![i++].value)
    if (i !== et50.zones!!.length) {
      throw new Error(`You didn\'t parse every zones of the ET${etNumber}`)
    }

    return {
      errorDetail: et50.errorDetail,
      recordOrderNumber,
      sex,
      montantInterventionAssurance,
      units,
      prescriberNihii,
      itemReference,
      tooth,
      thirdPartyException,
      treatedMember
    }
  }

  readET51(et51: Record): ET51Data {
    const etNumber = 51
    let i = 0
    this.log("EnregistrementType", et51.zones!![i].value)
    if (et51.zones!![i].value !== etNumber.toString()) {
      throw new Error(
        `Trying to parse an ET${etNumber} that is not an ET${etNumber} --- ${JSON.stringify(et51)}`
      )
    }
    i++
    const recordOrderNumber = this.log(
      "numero d'ordre de l'enregistrement",
      et51.zones!![i++].value
    )

    this.log("reserve", et51.zones!![i++].value)
    const prestationCode = this.log(
      "code nomenclature ou pseudo-code nomenclature",
      et51.zones!![i++].value
    )

    const prestationDate = this.log("date prestation", et51.zones!![i++].value)

    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    const recipientIdentifier = this.log("identification beneficiaire", et51.zones!![i++].value)

    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    const careProviderIdentifier = this.log(
      "identification du dispensateur",
      et51.zones!![i++].value
    )

    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    const reimbursementAmount = this.log(
      "signe + montant intervention de l'assurance",
      et51.zones!![i++].value
    )

    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    const ct1ct2 = this.log("ct1 + ct2", et51.zones!![i++].value)

    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    const networkReferenceData = this.log(
      "42,43a,43b,44,donnees de reference reseau",
      et51.zones!![i++].value
    )

    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    const infoCommunicationDate = this.log(
      "date communication information",
      et51.zones!![i++].value
    )

    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    this.log("reserve", et51.zones!![i++].value)
    const recordControlNumber = this.log(
      "Chiffres de controle de l'enregistrement",
      et51.zones!![i++].value
    )

    if (i !== et51.zones!!.length) {
      throw new Error(`You didn\'t parse every zones of the ET${etNumber}`)
    }
    return {
      errorDetail: et51.errorDetail,
      recordOrderNumber,
      prestationCode,
      prestationDate,
      recipientIdentifier,
      careProviderIdentifier,
      reimbursementAmount,
      ct1ct2,
      networkReferenceData,
      infoCommunicationDate,
      recordControlNumber
    }
  }

  readET52(et52: Record): ET52Data {
    const etNumber = 52
    let i = 0
    if (et52.zones!![i].value !== etNumber.toString()) {
      throw new Error(
        `Trying to parse an ET${etNumber} that is not an ET${etNumber} --- ${JSON.stringify(et52)}`
      )
    }
    this.log("Enregistrement de type 52", et52.zones!![i++].value)
    const recordOrderNumber = this.log(
      "Numero d'ordre de l'enregistrement",
      et52.zones!![i++].value
    )

    this.log("reserve", et52.zones!![i++].value)
    const nomenCode = this.log("Code nomenclature", et52.zones!![i++].value)

    const prestationDate = this.log("Date de prestation", et52.zones!![i++].value)

    const eidDate = this.log(
      "Date de lecture document identite electronique (1 et 2)",
      et52.zones!![i++].value
    )

    this.log("reserve", et52.zones!![i++].value)
    this.log(
      "Numero NISS du patient sauf en cas de convention internationale ou nouveaux-nes (1 et 2)",
      et52.zones!![i].value
    )
    const patientINSS = et52.zones!![i].value
    i++
    this.log("reserve", et52.zones!![i++].value)
    const eidSupportType = this.log(
      "Type de support document identite electronique",
      et52.zones!![i++].value
    )

    const eidReadingType = this.log(
      "Type de lecture document identite electronique",
      et52.zones!![i++].value
    )

    const eidReadingHour = this.log(
      "Heure de lecture document identite electronique (1 et 2)",
      et52.zones!![i++].value
    )

    this.log("reserve", et52.zones!![i++].value)
    const nihii = this.log("Numero INAMI", et52.zones!![i++].value)

    this.log("reserve", et52.zones!![i++].value)
    this.log("Chiffres de controle de l'enregistrement", et52.zones!![i++].value)
    if (i !== et52.zones!!.length) {
      throw new Error(`You didn\'t parse every zones of the ET${etNumber}`)
    }
    return {
      errorDetail: et52.errorDetail,
      recordOrderNumber,
      nomenCode,
      prestationDate,
      eidDate,
      patientINSS,
      eidSupportType,
      eidReadingType,
      eidReadingHour,
      nihii
    }
  }

  readET80(et80: Record): ET80Data {
    const etNumber = 80
    let i = 0
    this.log("EnregistrementDeType80", et80.zones!![i].value)
    if (et80.zones!![i].value !== etNumber.toString()) {
      throw new Error(
        `Trying to parse an ET${etNumber} that is not an ET${etNumber} --- ${JSON.stringify(et80)}`
      )
    }
    i++
    this.log("NumeroDordreDeLenregistrement", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("HeureDadmission", et80.zones!![i++].value)
    this.log("DateDadmission", et80.zones!![i++].value)
    this.log("DateDeSortiePartie1et2", et80.zones!![i++].value)
    this.log("NumeroMutualiteDaffiliation", et80.zones!![i++].value)
    const recipientIdentifier = this.log(
      "IdentificationBeneficiairePartie1",
      et80.zones!![i++].value
    )

    this.log("SexeBeneficiaire", et80.zones!![i++].value)
    this.log("TypeFacture", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("Service721Bis", et80.zones!![i++].value)
    this.log("NumeroDeLetablissementQuiFacture", et80.zones!![i++].value)
    this.log("SigneMontantDeCompteFinancierB", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("CausesDuTraitement", et80.zones!![i++].value)
    this.log("NumeroMutualiteDeDestination", et80.zones!![i++].value)
    this.log("SigneMontantDeCompteFinancierA", et80.zones!![i++].value)
    this.log("DateDeLaFacturePartie1et2", et80.zones!![i++].value)
    this.log("HeureDeSortie", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("NumeroDeLaFactureIndividuellePartie1et2", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("SigneInterventionPersonnellePatient", et80.zones!![i++].value)
    this.log("ReferenceDeLetablissement", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("Z27SigneMontantSupplementPartie1et2", et80.zones!![i++].value)
    this.log("FlagIdentificationDuBeneficiaire", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("SigneAcompteNumeroCompteFinancierA", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("Reserve", et80.zones!![i++].value)
    this.log("chiffres de controle de la facture", et80.zones!![i++].value)
    this.log("Chiffres de controle de l'enregistrement", et80.zones!![i++].value)
    if (i !== et80.zones!!.length) {
      throw new Error(`You didn\'t parse every zones of the ET${etNumber}`)
    }
    return {
      errorDetail: et80.errorDetail,
      recipientIdentifier
    }
  }

  readET90(et90: Record): ET90Data {
    const etNumber = 90
    let i = 0
    if (et90.zones!![i].value !== etNumber.toString()) {
      throw new Error(
        `Trying to parse an ET${etNumber} that is not an ET${etNumber} --- ${JSON.stringify(et90)}`
      )
    }
    this.log("EnregistrementDeType90", et90.zones!![i++].value)
    this.log("NumeroDordreDeLenregistrement", et90.zones!![i++].value)
    this.log("Reserve", et90.zones!![i++].value)
    this.log("Reserve", et90.zones!![i++].value)
    const financialAccountNumber1 = this.log(
      "NumeroCompteFinancierAPartie1et2",
      et90.zones!![i++].value
    )

    this.log("Reserve", et90.zones!![i++].value)
    const sendingNumber = this.log("NumeroDenvoi", et90.zones!![i++].value)

    const financialAccountNumber2 = this.log("NumeroCompteFinancierB", et90.zones!![i++].value)

    this.log("Reserve", et90.zones!![i++].value)
    this.log("Reserve", et90.zones!![i++].value)
    this.log("Reserve", et90.zones!![i++].value)
    this.log("Reserve", et90.zones!![i++].value)
    this.log("Reserve", et90.zones!![i++].value)
    this.log("Reserve", et90.zones!![i++].value)
    const thirdPartyNumber = this.log("NumeroTiersPayant", et90.zones!![i++].value)

    this.log("SigneMontantTotalNumeroCompteFinancierB", et90.zones!![i++].value)
    this.log("Reserve", et90.zones!![i++].value)
    this.log("Reserve", et90.zones!![i++].value)
    this.log("Reserve", et90.zones!![i++].value)
    const signeAndTotalAmountCptA = this.log(
      "SigneMontantTotalNumeroCompteFinancierA",
      et90.zones!![i++].value
    )
    this.log("Reserve", et90.zones!![i++].value)
    this.log("Reserve", et90.zones!![i++].value)
    const invoicingYear = this.log("AnneeDeFacturation", et90.zones!![i++].value)

    const invoicingMonth = this.log("MoisDeFacturation", et90.zones!![i++].value)

    this.log("Reserve", et90.zones!![i++].value)
    this.log("Reserve", et90.zones!![i++].value)
    this.log("Reserve", et90.zones!![i++].value)
    const cbe = this.log("BCE", et90.zones!![i++].value)

    const invoiceReference = this.log("ReferenceDeLetablissement", et90.zones!![i++].value)

    this.log("Reserve", et90.zones!![i++].value)
    this.log("Reserve", et90.zones!![i++].value)
    const bic1 = this.log("BicCompteFinancierAPartie1_2_3et4", et90.zones!![i++].value)

    this.log("Reserve", et90.zones!![i++].value)
    const iban1 = this.log("IbanCompteFinancierAPartie1_2_3_4_5et6", et90.zones!![i++].value)

    this.log("Reserve", et90.zones!![i++].value)
    const bic2 = this.log("BicCompteFinancierB", et90.zones!![i++].value)

    this.log("Reserve", et90.zones!![i++].value)
    this.log("Reserve", et90.zones!![i++].value)
    this.log("Reserve", et90.zones!![i++].value)
    this.log("Reserve", et90.zones!![i++].value)
    this.log("Reserve", et90.zones!![i++].value)
    this.log("Reserve", et90.zones!![i++].value)
    const iban2 = this.log("IbanCompteFinancierBPartie1_2_3et4", et90.zones!![i++].value)

    this.log("Reserve", et90.zones!![i++].value)
    this.log("Reserve", et90.zones!![i++].value)
    this.log("Reserve", et90.zones!![i++].value)
    this.log("Reserve", et90.zones!![i++].value)
    this.log("Reserve", et90.zones!![i++].value)
    this.log("Reserve", et90.zones!![i++].value)
    this.log("Reserve", et90.zones!![i++].value)
    const invoiceControlNumber = this.log(
      "chiffres de controle de la facture",
      et90.zones!![i++].value
    )

    const recordControlNumber = this.log(
      "Chiffres de controle de l'enregistrement",
      et90.zones!![i++].value
    )

    if (i !== et90.zones!!.length) {
      throw new Error(`You didn\'t parse every zones of the ET${etNumber}`)
    }

    return {
      errorDetail: et90.errorDetail,
      financialAccountNumber1,
      sendingNumber,
      financialAccountNumber2,
      thirdPartyNumber,
      signeAndTotalAmountCptA,
      invoicingYear,
      invoicingMonth,
      invoiceReference,
      cbe,
      bic1,
      iban1,
      bic2,
      iban2,
      invoiceControlNumber,
      recordControlNumber
    }
  }

  readET91(et91: Record): ET91Data {
    const etNumber = 91
    let i = 0
    if (et91.zones!![i].value !== etNumber.toString()) {
      throw new Error(
        `Trying to parse an ET${etNumber} that is not an ET${etNumber} --- ${JSON.stringify(et91)}`
      )
    }
    this.log("Type", et91.zones!![i++].value)
    this.log("Code erreur", et91.zones!![i++].value)
    this.log("Lien T10 N mutualit", et91.zones!![i++].value)
    this.log("Code erreur", et91.zones!![i++].value)
    this.log("n facture recapitulative", et91.zones!![i++].value)
    this.log("Code erreur", et91.zones!![i++].value)
    this.log("Signe montant demand compte A", et91.zones!![i++].value)
    const askedAmountForAccount1 = this.log("Montant demand compte A", et91.zones!![i++].value)

    this.log("Code erreur", et91.zones!![i++].value)
    this.log("Signe montant demand compte B", et91.zones!![i++].value)
    const askedAmountForAccount2 = this.log("Montant demand compte B", et91.zones!![i++].value)

    this.log("Code erreur", et91.zones!![i++].value)
    this.log("Signe Montant demand A + B", et91.zones!![i++].value)
    const totalAskedAmount = this.log(
      "Montant demand compte A + B = lien Cpt A",
      et91.zones!![i++].value
    )

    this.log("Code erreur", et91.zones!![i++].value)
    const numberOfRecordBundle = this.log("Nombre d'enregistrement", et91.zones!![i++].value)

    this.log("Code erreur", et91.zones!![i++].value)
    this.log("Lien T80 Z98 N contrle par mutuelle", et91.zones!![i++].value)
    this.log("Code erreur", et91.zones!![i++].value)
    this.log("Signe montant accepté compte A", et91.zones!![i++].value)
    const acceptedAmountAccount1 = this.log("montant accepté compte A", et91.zones!![i++].value)

    this.log("Code erreur", et91.zones!![i++].value)
    this.log("Signe montant refusé compte A", et91.zones!![i++].value)
    const rejectedAmountAccount1 = this.log("montant refusé compte A", et91.zones!![i++].value)

    this.log("Code erreur", et91.zones!![i++].value)
    this.log("Signe montant accepté compte B", et91.zones!![i++].value)
    const acceptedAmountAccount2 = this.log("Montant accepté compte B", et91.zones!![i++].value)

    this.log("Code erreur", et91.zones!![i++].value)
    this.log("Signe montant refusé compte B", et91.zones!![i++].value)
    const rejectedAmountAccount2 = this.log("Montant refusé compte B", et91.zones!![i++].value)

    this.log("Code erreur", et91.zones!![i++].value)
    this.log("Signe total montants acceptés compte A + compte B", et91.zones!![i++].value)
    const totalAcceptedAmount = this.log(
      "Total montants acceptés compte A+compte B",
      et91.zones!![i++].value
    )

    this.log("Code erreur", et91.zones!![i++].value)
    this.log("Signe total montants refusés compte A + compte B", et91.zones!![i++].value)
    const totalRejectedAmount = this.log(
      "Total montants refusés compte A+compteB",
      et91.zones!![i++].value
    )

    this.log("Code erreur", et91.zones!![i++].value)
    const paymentReferenceAccount1 = this.log(
      "Référence paiement compte A OA ou mutualité",
      et91.zones!![i++].value
    )

    this.log("Code erreur", et91.zones!![i++].value)
    const paymentReferenceAccount2 = this.log(
      "Référence paiement compte B OA ou mutualité",
      et91.zones!![i++].value
    )

    this.log("Code erreur", et91.zones!![i++].value)
    this.log("Reserve", et91.zones!![i++].value)
    if (i !== et91.zones!!.length) {
      throw new Error(`You didn\'t parse every zones of the ET${etNumber}`)
    }
    return {
      askedAmountForAccount1,
      askedAmountForAccount2,
      totalAskedAmount,
      numberOfRecordBundle,
      acceptedAmountAccount1,
      rejectedAmountAccount1,
      acceptedAmountAccount2,
      rejectedAmountAccount2,
      totalAcceptedAmount,
      totalRejectedAmount,
      paymentReferenceAccount1,
      paymentReferenceAccount2
    }
  }

  readET92(et92: Record): ET92Data {
    const etNumber = 92
    let i = 0
    if (et92.zones!![i].value !== etNumber.toString()) {
      throw new Error(
        `Trying to parse an ET${etNumber} that is not an ET${etNumber} --- ${JSON.stringify(et92)}`
      )
    }
    this.log("Type", et92.zones!![i++].value)
    this.log("Code erreur", et92.zones!![i++].value)
    this.log("Lien T10 N mutualit", et92.zones!![i++].value)
    this.log("Code erreur", et92.zones!![i++].value)
    this.log("n facture recapitulative", et92.zones!![i++].value)
    this.log("Code erreur", et92.zones!![i++].value)
    this.log("Signe montant demand compte A", et92.zones!![i++].value)
    const askedAmountAccount1 = this.log("Montant demand compte A", et92.zones!![i++].value)

    this.log("Code erreur", et92.zones!![i++].value)
    this.log("Signe montant demand compte B", et92.zones!![i++].value)
    const askedAmountAccount2 = this.log("Montant demand compte B", et92.zones!![i++].value)

    this.log("Code erreur", et92.zones!![i++].value)
    this.log("Signe Montant demand A + B", et92.zones!![i++].value)
    const totalAskedAmount = this.log(
      "Montant demand compte A + B = lien Cpt A",
      et92.zones!![i++].value
    )

    this.log("Code erreur", et92.zones!![i++].value)
    const numberOfRecord = this.log("Nombre d'enregistrement", et92.zones!![i++].value)

    this.log("Code erreur", et92.zones!![i++].value)
    this.log("Lien T80 Z98 N contrle par mutuelle", et92.zones!![i++].value)
    this.log("Code erreur", et92.zones!![i++].value)
    this.log("Signe montant accepté compte A", et92.zones!![i++].value)
    const acceptedAmountAccount1 = this.log("montant accepté compte A", et92.zones!![i++].value)

    this.log("Code erreur", et92.zones!![i++].value)
    this.log("Signe montant refusé compte A", et92.zones!![i++].value)
    const rejectedAmountAccount1 = this.log("montant refusé compte A", et92.zones!![i++].value)

    this.log("Code erreur", et92.zones!![i++].value)
    this.log("Signe montant accepté compte B", et92.zones!![i++].value)
    const acceptedAmountAccount2 = this.log("Montant accepté compte B", et92.zones!![i++].value)

    this.log("Code erreur", et92.zones!![i++].value)
    this.log("Signe montant refusé compte B", et92.zones!![i++].value)
    const rejectedAmountAccount2 = this.log("Montant refusé compte B", et92.zones!![i++].value)

    this.log("Code erreur", et92.zones!![i++].value)
    this.log("Signe total montants acceptés compte A + compte B", et92.zones!![i++].value)
    const totalAcceptedAmount = this.log(
      "Total montants acceptés compte A+compte B",
      et92.zones!![i++].value
    )

    this.log("Code erreur", et92.zones!![i++].value)
    this.log("Signe total montants refusés compte A + compte B", et92.zones!![i++].value)
    const totalRejectedAmount = this.log(
      "Total montants refusés compte A+compteB",
      et92.zones!![i++].value
    )

    this.log("Code erreur", et92.zones!![i++].value)
    this.log("Réserve", et92.zones!![i++].value)
    if (i !== et92.zones!!.length) {
      throw new Error(`You didn\'t parse every zones of the ET${etNumber}`)
    }

    return {
      askedAmountAccount1,
      askedAmountAccount2,
      totalAskedAmount,
      numberOfRecord,
      acceptedAmountAccount1,
      rejectedAmountAccount1,
      acceptedAmountAccount2,
      rejectedAmountAccount2,
      totalAcceptedAmount,
      totalRejectedAmount
    }
  }

  readZone400(zone400: Record): Zone400Data {
    let i = 0
    this.log("Type", zone400.zones!![i++].value)
    this.log("Code d'erreur", zone400.zones!![i++].value)
    this.log("numero de mutuelle", zone400.zones!![i++].value)
    const mutuelle = zone400.zones!![i - 1].value
    this.log("code d'erreur", zone400.zones!![i++].value)
    this.log("numero de la facture recapitulative", zone400.zones!![i++].value)
    this.log("code d'erreur", zone400.zones!![i++].value)
    this.log("signe montant demande compte A", zone400.zones!![i++].value)
    const signMontantA = zone400.zones!![i - 1].value
    this.log("montant demande compte A", zone400.zones!![i++].value)
    const montantDemandeA = zone400.zones!![i - 1].value
    this.log("code d'erreur", zone400.zones!![i++].value)
    this.log("signe montant demande compte B", zone400.zones!![i++].value)
    this.log("montant demande compte B", zone400.zones!![i++].value)
    this.log("code d'erreur", zone400.zones!![i++].value)
    this.log("signe somme A + B", zone400.zones!![i++].value)
    this.log("total somme A + B", zone400.zones!![i++].value)
    this.log("code d'erreur", zone400.zones!![i++].value)
    this.log("nombre d'enregistrements", zone400.zones!![i++].value)
    this.log("code d'erreur", zone400.zones!![i++].value)
    this.log("numero de controle par mutualite", zone400.zones!![i++].value)
    const controleMut = zone400.zones!![i - 1].value
    this.log("code d'erreur", zone400.zones!![i++].value)
    this.log("reserve", zone400.zones!![i++].value)

    if (zone400.zones!!.length !== i) {
      throw Error("Zone 400: The parsing is not matching the available number of zones.")
    }

    return {
      mutualityNumber: mutuelle,
      signAmount1: signMontantA,
      askedAmount1: montantDemandeA,
      mutualityControlNumber: controleMut
    }
  }

  readZone500(zone500: Record): Zone500Data {
    let i = 0
    this.log("Type", zone500.zones!![i++].value)
    this.log("Code d'erreur", zone500.zones!![i++].value)
    this.log("numero de mutuelle", zone500.zones!![i++].value)
    const mutuelle = zone500.zones!![i - 1].value
    this.log("code d'erreur", zone500.zones!![i++].value)
    this.log("non utlise", zone500.zones!![i++].value)
    this.log("code d'erreur", zone500.zones!![i++].value)
    this.log("numero de la facture recapitulative", zone500.zones!![i++].value)
    this.log("code d'erreur", zone500.zones!![i++].value)
    this.log("signe montant demande compte A", zone500.zones!![i++].value)
    const signMontantA = zone500.zones!![i - 1].value
    this.log("montant demande compte A", zone500.zones!![i++].value)
    const montantDemandeA = zone500.zones!![i - 1].value
    this.log("code d'erreur", zone500.zones!![i++].value)
    this.log("signe montant demande compte B", zone500.zones!![i++].value)
    this.log("montant demande compte B", zone500.zones!![i++].value)
    this.log("code d'erreur", zone500.zones!![i++].value)
    this.log("signe somme A + B", zone500.zones!![i++].value)
    this.log("total somme A + B", zone500.zones!![i++].value)
    this.log("code d'erreur", zone500.zones!![i++].value)
    this.log("nombre d'enregistrements", zone500.zones!![i++].value)
    this.log("code d'erreur", zone500.zones!![i++].value)
    this.log("numero de controle par mutualite", zone500.zones!![i++].value)
    const controleMut = zone500.zones!![i - 1].value
    this.log("code d'erreur", zone500.zones!![i++].value)
    this.log("reserve", zone500.zones!![i++].value)

    if (zone500.zones!!.length !== i) {
      throw Error("Zone 500: The parsing is not matching the available number of zones.")
    }

    return {
      mutualityNumber: mutuelle,
      signAmount1: signMontantA,
      askedAmount1: montantDemandeA,
      mutualityControlNumber: controleMut
    }
  }
}

export class EfactMessage920900Reader extends EfactMessageReader {
  fileType = "920900"

  read(): File920900Data | undefined {
    try {
      let i = 0
      // FIXME the code does not support multiple invoices yet.
      const rawRecords = this.message.message!!
      const zone200 = this.readZone200(rawRecords[i])
      i++
      const zone300 = this.readZone300(rawRecords[i])
      i++
      const et10 = this.readET10(rawRecords[i])
      i++
      const records = []
      while (rawRecords[i].zones!![0].value === "20") {
        const et20 = this.readET20(rawRecords[i])
        i++
        const items = []
        while (
          rawRecords[i].zones!![0].value === "50" ||
          rawRecords[i].zones!![0].value === "51" ||
          rawRecords[i].zones!![0].value === "52"
        ) {
          let et50
          let et51
          let et52
          if (rawRecords[i].zones!![0].value === "50") {
            et50 = this.readET50(rawRecords[i])
            i++
          }
          if (rawRecords[i].zones!![0].value === "51") {
            et51 = this.readET51(rawRecords[i])
            i++
          }
          if (rawRecords[i].zones!![0].value === "52") {
            et52 = this.readET52(rawRecords[i])
            i++
          }

          items.push({
            et50,
            et51,
            et52
          })
        }
        const et80 = this.readET80(rawRecords[i])
        i++
        records.push({
          et20,
          items,
          et80
        })
      }
      const et90 = this.readET90(rawRecords[i])
      i++
      const et91s = []
      while (rawRecords[i].zones!![0].value === "91") {
        et91s.push(this.readET91(rawRecords[i]))
        i++
      }
      const et92 = this.readET92(rawRecords[i])
      i++

      if (rawRecords.length !== i) {
        throw new Error("EfactMessage was not entirely parsed " + JSON.stringify(this.message))
      }

      return {
        zone200,
        zone300,
        et10,
        records,
        et90,
        et91: et91s,
        et92
      }
    } catch (err) {
      console.error(err, "Cannot parse message", this.message)
    }
  }
}

export class EfactMessage931000Reader extends EfactMessageReader {
  fileType = "931000"

  read(): File931000Data | undefined {
    const zone200 = this.readZone200(this.message.message!![0])
    return {
      zone200
    }
  }
}

export class EfactMessage920099Reader extends EfactMessageReader {
  fileType = "920099"

  read(): File920099Data | undefined {
    try {
      let i = 0
      // FIXME the code does not support multiple invoices yet.
      const rawRecords = this.message.message!!
      const zone200 = this.readZone200(rawRecords[i])
      i++
      const zone300 = this.readZone300(rawRecords[i])
      i++
      const et10 = this.readET10(rawRecords[i])
      i++
      const records = []
      while (rawRecords[i].zones!![0].value === "20") {
        const et20 = this.readET20(rawRecords[i])
        i++
        const items = []
        while (
          rawRecords[i].zones!![0].value === "50" ||
          rawRecords[i].zones!![0].value === "51" ||
          rawRecords[i].zones!![0].value === "52"
        ) {
          let et50
          let et51
          let et52
          if (rawRecords[i].zones!![0].value === "50") {
            et50 = this.readET50(rawRecords[i])
            i++
          }
          if (rawRecords[i].zones!![0].value === "51") {
            et51 = this.readET51(rawRecords[i])
            i++
          }
          if (rawRecords[i].zones!![0].value === "52") {
            et52 = this.readET52(rawRecords[i])
            i++
          }

          items.push({
            et50,
            et51,
            et52
          })
        }
        const et80 = this.readET80(rawRecords[i])
        i++
        records.push({
          et20,
          items,
          et80
        })
      }
      const et90 = this.readET90(rawRecords[i])
      i++

      if (rawRecords.length !== i) {
        throw new Error("EfactMessage was not entirely parsed " + JSON.stringify(this.message))
      }

      return {
        zone200,
        zone300,
        et10,
        records,
        et90
      }
    } catch (err) {
      console.error(err, "Cannot parse message", this.message)
    }
  }
}

export class EfactMessage920098Reader extends EfactMessageReader {
  fileType = "920098"

  read(): File920098Data | undefined {
    try {
      let i = 0
      // FIXME the code does not support multiple invoices yet.
      const rawRecords = this.message.message!!
      const zone200 = this.readZone200(rawRecords[i])
      i++
      const zone300 = this.readZone300(rawRecords[i])
      i++
      const et10 = this.readET10(rawRecords[i])
      i++
      const records = []
      while (rawRecords[i].zones!![0].value === "20") {
        const et20 = this.readET20(rawRecords[i])
        i++
        const items = []
        while (
          rawRecords[i].zones!![0].value === "50" ||
          rawRecords[i].zones!![0].value === "51" ||
          rawRecords[i].zones!![0].value === "52"
        ) {
          let et50
          let et51
          let et52
          if (rawRecords[i].zones!![0].value === "50") {
            et50 = this.readET50(rawRecords[i])
            i++
          }
          if (rawRecords[i].zones!![0].value === "51") {
            et51 = this.readET51(rawRecords[i])
            i++
          }
          if (rawRecords[i].zones!![0].value === "52") {
            et52 = this.readET52(rawRecords[i])
            i++
          }

          items.push({
            et50,
            et51,
            et52
          })
        }
        const et80 = this.readET80(rawRecords[i])
        i++
        records.push({
          et20,
          items,
          et80
        })
      }
      const et90 = this.readET90(rawRecords[i])
      i++

      if (rawRecords.length !== i) {
        throw new Error("EfactMessage was not entirely parsed " + JSON.stringify(this.message))
      }

      return {
        zone200,
        zone300,
        et10,
        records,
        et90
      }
    } catch (err) {
      console.error(err, "Cannot parse message", this.message)
    }
  }
}

export class EfactMessage920999Reader extends EfactMessageReader {
  fileType = "920999"

  read(): File920999Data | undefined {
    try {
      let i = 0
      // FIXME the code does not support multiple invoices yet.
      let rawRecords = this.message.message!!

      const zone200 = this.readZone200(rawRecords[i++])
      const zone300 = this.readZone300Short(rawRecords[i++])
      let et95 = []
      while (rawRecords[i] && rawRecords[i].zones!![0].value === "95") {
        const zone400 = this.readZone400(rawRecords[i++])
        et95.push(zone400)
      }
      let et96
      if (rawRecords[i] && rawRecords[i].zones!![0].value === "96") {
        et96 = this.readZone500(rawRecords[i++])
      }

      if (rawRecords.length !== i) {
        throw new Error("EfactMessage was not entirely parsed " + JSON.stringify(this.message))
      }

      return {
        zone200,
        zone300,
        et95,
        et96
      }
    } catch (err) {
      console.error(err, "Cannot parse message", this.message)
    }
  }
}
