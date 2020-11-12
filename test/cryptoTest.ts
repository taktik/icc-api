/* make node behave */
import { IccPatientApi } from "../icc-api/api/IccPatientApi"
import { crypto } from "../node-compat"
import { expect } from "chai"
import "mocha"

import { Api } from "../icc-x-api"
import { User } from "../icc-api/model/User"
import { Patient } from "../icc-api/model/Patient"

const privateKeys: { [key: string]: string } = {
  "37d470b5-1931-40e2-b959-af38545d8b67":
    "308204bd020100300d06092a864886f70d0101010500048204a7308204a30201000282010100bbeb917d088281070ccf9bfda524f30e3f148f077d54f2edb0271d731712a350882b1f6355ca50577be4d047690b6fe0c6a4a2a6d23374def7edbb661084991252ea5ad99a5fe6d049fb15159981a67e70786a5b3449c10356b30cbc129ec3a8e27eec408c3492b0176a741191f12a3cffb1422fec22a45ce2e5170f07bb83d1a96f7335c25629ce6289d04941ebfded5714f9378c44988a952af5844c74802e762040faed6cb38dfd67c98b33afa595161d2139d114715384114efde5d6f3cc2f9e67ca20a38234a01eba06f9e5f342048227a946a33e4450291f682c73c1e7fc7e1cfb0e560278725107518ea79e068bcb914d23b6a49643abc72c79b69fb1020301000102820100079b9fa2017e7115553c317b491c9017874fc083a3dc14d2b1234042b8d0291af94c4fa2c0a6266f0845c8f5df2796a1b1c11811ab6868669f80792a0668abdecd4b0e1f09ac30c6c57bfc0c4a10f0e9e50946fb06c8a69f093b49fc723f89b9d463a192726aad76a2180df769226b9c991876cec45f59aaa607f2d149b59a7e4879d0f3cf263eb2859d593d6a4233b25e4923966c2b4449417aeec6366a040a81c72da9a9065f204e3820574d62bea29d84a46b564d72177cfa0c2274d8c2d1d37b5c388b74d87b19382293d648cdb7509c159fd596c9e00888576f1479b1a1fdaa4a819f629177391040cc7afbb73367d479f0642d759fc062e1e71a55810d02818100e31772aafb7d0ea0ae98a962b2699137751c20e4cedbbfccb4135f858d655def739da2fe63a08ff53e7ec8b778972834b2e80efb0541ef0d5aedf530cdfd8c33dbd0b0e35d09425933164597a601f2946047f0bb1b34cfa65f933d46dd83cb95c4b1b8e0f2f1d5e6626544d71de9f7ac2862d3c951ac2a5b23852dda8012a6d502818100d3d796405412cb8d62e81ed7c00df2688d22f2f27eb9580d555cef34bc623c76bf62ffef4d39c18ce49824826b83c7902e67a8e8c8399d20a53705e81c631f2045375ede1c8c6f1796e29a98f9785f831588ff18e461d1f118534fc4eeaaacda924648a9032dde00d949d278eaebb42fe22da420be27bb506c7b61b8ce48bb6d0281801d7a3eb5391ddb9739f2b11211aca85ff580a8386b2d95310232fd943d6d6a0b1a0bdd4b7e2d2a62a0311ee6c9ed7d17921d934c3c3b79c757054a6d825fa622592736bedca5c60a041aa0fff5598d5e7b3cfb5f9e4175aed7fb29da1808f2954749f680a4a885a6792142155659b77f8e627db1453bbee7c3ad96ed24f0c6dd028181009acbf14606694986821c9dd507c8e9368ed357f5ecb5e0eab552d8948f87b5290c86f9ffd24d7eea466c0a59a6d8bfadd2cafa79473e1a5c2d7dfc79f4ac55a54e0ebceaceafabc9effe9bfb6668185b0014805b9f1effbb0e0c6ac0bba9c9ef596db450943b22fb39cc20d92cc8997d57e80403cd0fd967562dfe657d8f562d02818055c0c2c04e84edadc3516318266ed203fa25c9c6ef2b4115afadb1e07713c1d53193c4295fc10a42181eb3249ec01b61912c314f0e358a9779b7c5b167a36091c9fbb4cd91935be649e6c79d9507dcc5088dc40d4829357967e13df59fd68cec755a38771fec809d694acccc288b97b879fb16eba84edaaa6b67b77138f2cbb7",
  "0db6818b-b8e6-470e-8be7-66e4ff0963d4":
    "308204bd020100300d06092a864886f70d0101010500048204a7308204a30201000282010100a036396b2f61193a3cbf9bb5c98334814529bc4dd26d8a669c3ca06dd497051ae813af61cf64a939b1357f13081ec1a7f00c7059734d6381a6844893feba68f91bee2c3bfe483d7690487bc1c2670d585f93d616692675a53787c3a1f75795cbe3e31b2bca8e6f669e48ab8913fa0ee3f4cc1e4d9f62a08660ed85274415270072d0d5475407f7ace36d5f86e974c38847b4f74904dee3d2d269fdd851a69c5b0572996fd88ab323cc928b48ade7335143fd1c44738819f1cb08f2657a0ac2a2df0d958b29c8ac82c052397897c294cd4cb6e5e9ee43b6b4e0f6055d143fb8fa35737699bb37cc58901c638f45db954df4257dcdaadbaf9fbb6a8438bcadb46702030100010282010048116c4dcf6fcdc1d93ed603f5c45c138471ac3f93976be91181e226d5b92376418c4d59e1c9a5a80a938678a0aff92c1abaf5b4ff3d8233f99c4aebabebddb9a53b43d1aee67f237ceee620b85ad3f17b790c966331863d4e57f7843db7bbee0e32846ff3fb9398253e8a4f2cd9d0e5f121fac5af1b561b6cb19bb298992d43fad67b3b4a8643a230a0f5a323647f7c68ab93a4cb466c8ea4b24b77e3d443698f06ca40a3f488400ae348e0964f07482336c14346e2baebc8cdcea71373295013fbe1d82a165a719035b5447550490464589015043e0576dc349387a4de94718033b8ae8319223405b94b4f365717abd183a4d03346eef64c5a15aed0c6ce8502818100def72f273a3063e8bc9f890f632f4fab3580dae6fd81d886e387776a49e0956e7f804b9e371f99cc6b98fdef798a7b1ad78dea31d61a7cc3103cff25c8a4fa3ce98b41de1a316ed32336cbc365566b939ed17f9983f03272c6ea92295e2a2a1dfa68c82a3e735b29dd30103d22b724b0bef7f4f523978fc048326a38dcdf323502818100b7f2dda58a8e5e2bb84904a67c583a5260c08cbac03a9e78c9604a30780fabe4e87c759625359f793a08c38168926c553aa379de8bd14bc277cbf7ca98bcf705fad2e8a73d33a908e18082eccc4bb095dba6a388977d67b099b572e9dc8f4d07452920a2050faa9c5a619ecee982a1c831dea50344d019741de2a86e36cfdfab0281805ae19435c011235825323df2a8b20b1e3523bd9633b4ae6664edbdadf448f77fdfb6929bfdca02ad811a0e3f8361ffc5b420e359c6f46af033793962d442f2c0cb4cf8df27fc0839457c3b57fcc159fe04d94dd26c2606da23dc4f114f918e3343f35bcb64432ee08488e7c59395e4fdaa0975ae4a00a8166f172596e1e8941502818022f2863fa422462be2382525082caeefe5a7cf54cf9e936af93f4cf906665bcf02885ac2aad1143a30d76765579bb1ef4353b99c994dab2a081e7d36456c6935fea041493cac6ae9e005cd59f5ba4f933906e0bcdba31ca7059cde7725cb27e440b47e99a9827f74730b66e382a3a9dee1f29dc1103ac50b357e5167970c493f02818100b5b0830675cde996bd1f3060b5be3fd776921658057ec3fb521d9eb6d129566aeb4e80b520a03ebbb6c98e78cedf63ea921a86cf8121fcdfd1d54109f46a4d266e135fea75c5fde8a5fcd6c3e7f3e79b00fd467cf322dd7329c38459fa4dda49e3f2194162d6da56bd6a2928d40f2a9e2f435646fec1c2c8af16870bd5481a4f",
  "782f1bcd-9f3f-408a-af1b-cd9f3f908a98":
    "308204bd020100300d06092a864886f70d0101010500048204a7308204a302010002820101009ad2f63357da7bb9b67b235b50f66c4968b391ba3340c4c4a697d0495512bff35f3692ffdcc867fa0602819d9fe9353f049b6c69e2dbf4a987e4d1b88b9475307c41427b33af8c0a6779a8347122f032cb801b54e2ce54e2edef2b1ae1f440a797945a4d0ab541711866ea32d096fe2da943bdd8251345fd8f50b0481e88f52e326a2cc9446d125c9643650182dbebf0272da6004a954acc21f8f47236fa7d3bbb256fb932aceb9b0fe081af27a3b476d0885905526b0e5faaa7d712536b77b05ff29a36b617a17ef611b8876346cc9ff864a295cc9ec2d5fe0efb0d94d99e5db96ea36a96d95ec63de639d243c74c773a4c350236265f71260de0fcd5fbb94b02030100010282010100878dd589b68dd06e155b52e58cc9749e0151d77193964db16fbad3dea0e1bdb633d2f0799cb0ca7899f26fd1b644d51dcbc6d8f10c73508f6e2fe57f129674d472b620a305e9d94ef2b20d977cc6fe4f3ae57b08a35bcbeeb42c072d8e4ff09bcb975448c7eb52d4d66ca4f8c0b0b2f2ff94140fbec6552d5fe161b683259ea3e95278ac83826f0674a4b0b5b6c717087abce79c73c9f6bf7832ef7337d8b07912244c30e3dc59512b8d2ab0fec288d8e561e29985e7eaaaa1e010a52ed025f5fa201c893214a42d9b17eff87752902063a1accc4eb169cd408aec4ee95e588e0bf5fccb6e945e67b965c6fb5d936c1b8cbf5e6dd6f7a9b8b4dd25f68ffcb68102818100ddc101d385681b81f527edb6dce5cb7ca9e2e7cb28fa1187933628bfbc38e9c153cd3783453a7e0ffbd2ad28ef67e879e08744d7148e83b3cb3fb7282ac03feed5d44cb7e70d014b1aef213d0c057d3d6c75653739ee22ba794c0a5f6194db84c6df3e0dddbdf57b1cc114881015f49c26eda572470dc708d2a1abc4c541671b02818100b2bbe5ab2f5d41323c8c9a6b65daf0771f416abc6c8c6b08a2bcd632e6ebba0d9efb6d99b435a3ae5b1b2b3ef450648e361bc6c480902d25b459ad120c05286ab7f91e24ecc8516ba9db086e8dabf5bb4ba97ef1c4c20a751841e472a41132145623eca0ca4fbb3025b4fb7430e0e5258afedb5017c2a0dd66cb8bcf0d172991028180345bc8049b71335d81f70587b1ac88594cfb88634daf8dc807183892dcec4b351c864ddf2ecf5ac8875afd0bb74b3f76d76ed8f037a856ac7306fe45fba21cf65582a5029f09510edcb32d93ee6cb55f75665a99a991f29d38da9d705be7fbd4e3e7fe0ce4186007cb884342c5198a01fca70bf3699775313e1a722629b5019502818006e5ab5234ccb3745dd3cb2db3cb841604b5c089aee2a84ab804f37b19602558db36b69f04ce4117bc5a4b0beddfa051c092c7d3d3663ce7c492e553d9f4e4ff614412beb8086ee3e9b51319390c56ba388c3ce2d585eb6363613f9090f63ce97dfd7ae725877820be83c264547289452e9cf117a123189412a06e2fba40979102818070faf47286b59425cb7c2f617f2b7b1b280b932f131a86b82e63c4fb240525ab40323ab902c507a4aee337f9f95b89aa9151d1ae2882bff497396e680407f5407ca154f20047017022eda8fe0438a473fb38123d36bc51bffc69e3c13fab4ecf16057529265e2c0993ca8886cc019c65e9460fe549b553fa48bb0f3ca0975e78"
}

const api = Api("http://localhost:16043/rest/v1", "abdemo", "knalou", crypto)
let mhapi = Api(
  "https://kraken.icure.dev/rest/v1",
  "tz-dev-master-615cd8f9-4951-409b-87d8-116378c66f16/371279d6-cfdb-4ee8-b36d-b1ccb9b8568d",
  "Ztf993pf",
  crypto
)

describe("Create a patient from scratch", () => {
  it("should create a patient in the database", async () => {
    try {
      const user = await api.userApi.getCurrentUser()
      await initKeys(api, user)

      const patient = await api.patientApi.createPatientWithUser(
        user,
        await api.patientApi.newInstance(
          user,
          new Patient({
            lastName: "Biden",
            firstName: "Joe",
            note: "A secured note that is encrypted"
          })
        )
      ) //curl -X POST "https://kraken.svc.icure.cloud/rest/v1/patient" -u abdemo:knalou -H  "Content-Type: application/json" -d '{"id":"...","lastName":"Biden","firstName":"Joe",note:"A secured note that is encrypted", "delegations":{...}, "encryptedKeys":{...}, "encryptedSelf":"..."'

      console.log(
        `Created patient (decrypted): ${patient.id}: ${patient.firstName} ${
          patient.lastName
        } [note:${patient.note}, encryptedSelf:${patient.encryptedSelf}]`
      )

      const fetched = await api.patientApi.getPatientWithUser(user, patient.id)
      console.log(
        `Fetched patient (decrypted): ${fetched.id}: ${fetched.firstName} ${
          fetched.lastName
        } [note:${patient.note}, encryptedSelf:${patient.encryptedSelf}]`
      )

      const fetchedWithoutDecryption = await new IccPatientApi(
        "https://kraken.svc.icure.cloud/rest/v1",
        {
          Authorization: `Basic ${Buffer.from("abdemo:knalou").toString("base64")}`
        },
        fetch as any
      ).getPatient(patient.id)
      console.log(
        `Fetched patient (encrypted):${fetchedWithoutDecryption.id}: ${
          fetchedWithoutDecryption.firstName
        } ${fetchedWithoutDecryption.lastName} [note: ${fetchedWithoutDecryption.note}]`
      )
    } catch (e) {
      console.log(e)
    }
  })
})

describe("Init confidential delegation in patient", () => {
  it("should return a patient with a confidential delegation", async () => {
    try {
      const user = await api.userApi.getCurrentUser()
      await initKeys(api, user)

      const pat = await api.patientApi.newInstance(user, { firstName: "John", lastName: "Doe" })
      const modifiedPatient = await api.patientApi.initConfidentialDelegation(pat, user)

      const confidentialDelegationKey = await api.cryptoApi.extractPreferredSfk(
        pat,
        user.healthcarePartyId!,
        true
      )
      const nonConfidentialDelegationKey = await api.cryptoApi.extractPreferredSfk(
        pat,
        user.healthcarePartyId!,
        false
      )

      expect(confidentialDelegationKey === nonConfidentialDelegationKey).to.equal(false)
    } catch (e) {
      console.log(e)
    }
  })
})

async function initKeys(api: any, user: User) {
  let id = user.healthcarePartyId
  while (id) {
    await api.cryptoApi
      .loadKeyPairsAsTextInBrowserLocalStorage(id, api.cryptoApi.utils.hex2ua(privateKeys[id]))
      .catch((error: any) => {
        console.error("Error: in loadKeyPairsAsTextInBrowserLocalStorage")
        console.error(error)
      })

    id = (await api.healthcarePartyApi.getHealthcareParty(id)).parentId
  }
}

describe("Test that patient information can be decrypted", () => {
  it("should return a contact with decrypted information", async () => {
    try {
      const user = await api.userApi.getCurrentUser()
      await initKeys(api, user)

      const pat = await api.patientApi.getPatientWithUser(
        user,
        "Pat_2015022022080888491_ms-gerard-delacroix-prd-10c50a01-5670-477b-a4a1-e6bb737325ce"
      )

      expect(pat.delegations).to.not.empty

      const contacts = await api.contactApi.findBy(user.healthcarePartyId!, pat)
      const hes = await api.healthcareElementApi.findBy(user.healthcarePartyId!, pat)

      expect(contacts).to.not.empty
      expect(hes).to.not.empty
    } catch (e) {
      console.log(e)
    }
  })
})

describe("Test that contact information can be decrypted", () => {
  it("should return a contact with decrypted information", async () => {
    try {
      const user = await api.userApi.getCurrentUser()
      await initKeys(api, user)

      const pat = await api.patientApi.createPatientWithUser(
        user,
        await api.patientApi.newInstance(user, { firstName: "John", lastName: "Doe" })
      )
      const ctc = await api.contactApi.createContactWithUser(
        user,
        await api.contactApi.newInstance(user, pat, {
          services: [
            {
              id: api.cryptoApi.randomUuid(),
              content: { fr: { stringValue: "Salut" }, nl: { stringValue: "Halo" } }
            },
            {
              id: api.cryptoApi.randomUuid(),
              content: {
                fr: {
                  compoundValue: [
                    { content: { fr: { stringValue: "Salut" } } },
                    { content: { fr: { stringValue: "à toi" } } }
                  ]
                }
              }
            }
          ]
        })
      )
      const check = await api.contactApi.getContactWithUser(user, ctc.id)

      expect(check.services[0].content.fr.stringValue).to.equal(
        ctc.services[0].content.fr.stringValue
      )
      expect(check.services[0].content.nl.stringValue).to.equal(
        ctc.services[0].content.nl.stringValue
      )
      expect(check.services[0].encryptedSelf).to.not.be.null

      expect(check.services[1].content.fr.compoundValue[0].content.fr.stringValue).to.equal(
        ctc.services[1].content.fr.compoundValue[0].content.fr.stringValue
      )
      expect(check.services[1].content.fr.compoundValue[0].encryptedSelf).to.not.be.null

      expect(check.services[1].content.fr.compoundValue[1].content.fr.stringValue).to.equal(
        ctc.services[1].content.fr.compoundValue[1].content.fr.stringValue
      )
      expect(check.services[1].content.fr.compoundValue[1].encryptedSelf).to.not.be.null
    } catch (e) {
      console.log(e)
      throw e
    }
  })
})
describe("test that confidential helement information cannot be retrieved at MH level", () => {
  it("should find the confidential data only when logged as the user", async () => {
    try {
      const user = await api.userApi.getCurrentUser()
      const mhUser = await mhapi.userApi.getCurrentUser()
      await initKeys(api, user)
      await initKeys(mhapi, mhUser)

      const pat = await api.patientApi.newInstance(user, { firstName: "John", lastName: "Doe" })
      const modifiedPatient = (await api.patientApi.initConfidentialDelegation(pat, user))!!

      await api.healthcareElementApi.createHealthElement(
        await api.healthcareElementApi.newInstance(
          user,
          modifiedPatient,
          { descr: "Confidential info" },
          true
        )
      )

      const retrievedHesAsUser = await api.healthcareElementApi.findBy(
        user.healthcarePartyId!,
        modifiedPatient
      )
      const retrievedHesAsMh = await mhapi.healthcareElementApi.findBy(
        mhUser.healthcarePartyId!,
        modifiedPatient
      )

      expect(retrievedHesAsUser.length).to.equal(1, "User should see its confidential data")
      expect(retrievedHesAsMh.length).to.equal(0, "MH should not see confidential data")
    } catch (e) {
      console.log(e)
    }
  })
})

describe("test that confidential contact information cannot be retrieved at MH level", () => {
  it("should find the confidential data only when logged as the user", async () => {
    try {
      const user = await api.userApi.getCurrentUser()
      const mhUser = await mhapi.userApi.getCurrentUser()
      await initKeys(api, user)
      await initKeys(mhapi, mhUser)

      const pat = await api.patientApi.newInstance(user, { firstName: "John", lastName: "Doe" })
      const modifiedPatient = (await api.patientApi.initConfidentialDelegation(pat, user))!!

      await api.contactApi.createContactWithUser(
        user,
        await api.healthcareElementApi.newInstance(
          user,
          modifiedPatient,

          { descr: "Confidential info", services: [], subContacts: [] },
          true
        )
      )

      await api.contactApi.createContactWithUser(
        user,
        await api.healthcareElementApi.newInstance(
          user,
          modifiedPatient,

          { descr: "Non confidential info", services: [], subContacts: [] },
          false
        )
      )

      const retrievedCtcsAsUser = await api.contactApi.findBy(
        user.healthcarePartyId!,
        modifiedPatient
      )
      const retrievedCtcsAsMh = await mhapi.contactApi.findBy(
        mhUser.healthcarePartyId!,
        modifiedPatient
      )

      expect(retrievedCtcsAsUser.length).to.equal(2, "User should see its confidential data")
      expect(retrievedCtcsAsMh.length).to.equal(1, "MH should not see confidential data")
    } catch (e) {
      console.log(e)
    }
  })
})
