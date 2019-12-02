import { expect } from "chai"
import "mocha"

import fetch from "node-fetch"
import { Api } from "./api"
import { UserDto } from "../icc-api/model/UserDto"
const tmp = require("os").tmpdir()
console.log("Tmp dir: " + tmp)
;(global as any).localStorage = new (require("node-localstorage")).LocalStorage(
  tmp,
  5 * 1024 * 1024 * 1024
)
;(global as any).Storage = ""

const privateKeys: { [key: string]: string } = {
  "37d470b5-1931-40e2-b959-af38545d8b67":
    "308204bd020100300d06092a864886f70d0101010500048204a7308204a30201000282010100bbeb917d088281070ccf9bfda524f30e3f148f077d54f2edb0271d731712a350882b1f6355ca50577be4d047690b6fe0c6a4a2a6d23374def7edbb661084991252ea5ad99a5fe6d049fb15159981a67e70786a5b3449c10356b30cbc129ec3a8e27eec408c3492b0176a741191f12a3cffb1422fec22a45ce2e5170f07bb83d1a96f7335c25629ce6289d04941ebfded5714f9378c44988a952af5844c74802e762040faed6cb38dfd67c98b33afa595161d2139d114715384114efde5d6f3cc2f9e67ca20a38234a01eba06f9e5f342048227a946a33e4450291f682c73c1e7fc7e1cfb0e560278725107518ea79e068bcb914d23b6a49643abc72c79b69fb1020301000102820100079b9fa2017e7115553c317b491c9017874fc083a3dc14d2b1234042b8d0291af94c4fa2c0a6266f0845c8f5df2796a1b1c11811ab6868669f80792a0668abdecd4b0e1f09ac30c6c57bfc0c4a10f0e9e50946fb06c8a69f093b49fc723f89b9d463a192726aad76a2180df769226b9c991876cec45f59aaa607f2d149b59a7e4879d0f3cf263eb2859d593d6a4233b25e4923966c2b4449417aeec6366a040a81c72da9a9065f204e3820574d62bea29d84a46b564d72177cfa0c2274d8c2d1d37b5c388b74d87b19382293d648cdb7509c159fd596c9e00888576f1479b1a1fdaa4a819f629177391040cc7afbb73367d479f0642d759fc062e1e71a55810d02818100e31772aafb7d0ea0ae98a962b2699137751c20e4cedbbfccb4135f858d655def739da2fe63a08ff53e7ec8b778972834b2e80efb0541ef0d5aedf530cdfd8c33dbd0b0e35d09425933164597a601f2946047f0bb1b34cfa65f933d46dd83cb95c4b1b8e0f2f1d5e6626544d71de9f7ac2862d3c951ac2a5b23852dda8012a6d502818100d3d796405412cb8d62e81ed7c00df2688d22f2f27eb9580d555cef34bc623c76bf62ffef4d39c18ce49824826b83c7902e67a8e8c8399d20a53705e81c631f2045375ede1c8c6f1796e29a98f9785f831588ff18e461d1f118534fc4eeaaacda924648a9032dde00d949d278eaebb42fe22da420be27bb506c7b61b8ce48bb6d0281801d7a3eb5391ddb9739f2b11211aca85ff580a8386b2d95310232fd943d6d6a0b1a0bdd4b7e2d2a62a0311ee6c9ed7d17921d934c3c3b79c757054a6d825fa622592736bedca5c60a041aa0fff5598d5e7b3cfb5f9e4175aed7fb29da1808f2954749f680a4a885a6792142155659b77f8e627db1453bbee7c3ad96ed24f0c6dd028181009acbf14606694986821c9dd507c8e9368ed357f5ecb5e0eab552d8948f87b5290c86f9ffd24d7eea466c0a59a6d8bfadd2cafa79473e1a5c2d7dfc79f4ac55a54e0ebceaceafabc9effe9bfb6668185b0014805b9f1effbb0e0c6ac0bba9c9ef596db450943b22fb39cc20d92cc8997d57e80403cd0fd967562dfe657d8f562d02818055c0c2c04e84edadc3516318266ed203fa25c9c6ef2b4115afadb1e07713c1d53193c4295fc10a42181eb3249ec01b61912c314f0e358a9779b7c5b167a36091c9fbb4cd91935be649e6c79d9507dcc5088dc40d4829357967e13df59fd68cec755a38771fec809d694acccc288b97b879fb16eba84edaaa6b67b77138f2cbb7",
  "0db6818b-b8e6-470e-8be7-66e4ff0963d4":
    "308204bd020100300d06092a864886f70d0101010500048204a7308204a30201000282010100a036396b2f61193a3cbf9bb5c98334814529bc4dd26d8a669c3ca06dd497051ae813af61cf64a939b1357f13081ec1a7f00c7059734d6381a6844893feba68f91bee2c3bfe483d7690487bc1c2670d585f93d616692675a53787c3a1f75795cbe3e31b2bca8e6f669e48ab8913fa0ee3f4cc1e4d9f62a08660ed85274415270072d0d5475407f7ace36d5f86e974c38847b4f74904dee3d2d269fdd851a69c5b0572996fd88ab323cc928b48ade7335143fd1c44738819f1cb08f2657a0ac2a2df0d958b29c8ac82c052397897c294cd4cb6e5e9ee43b6b4e0f6055d143fb8fa35737699bb37cc58901c638f45db954df4257dcdaadbaf9fbb6a8438bcadb46702030100010282010048116c4dcf6fcdc1d93ed603f5c45c138471ac3f93976be91181e226d5b92376418c4d59e1c9a5a80a938678a0aff92c1abaf5b4ff3d8233f99c4aebabebddb9a53b43d1aee67f237ceee620b85ad3f17b790c966331863d4e57f7843db7bbee0e32846ff3fb9398253e8a4f2cd9d0e5f121fac5af1b561b6cb19bb298992d43fad67b3b4a8643a230a0f5a323647f7c68ab93a4cb466c8ea4b24b77e3d443698f06ca40a3f488400ae348e0964f07482336c14346e2baebc8cdcea71373295013fbe1d82a165a719035b5447550490464589015043e0576dc349387a4de94718033b8ae8319223405b94b4f365717abd183a4d03346eef64c5a15aed0c6ce8502818100def72f273a3063e8bc9f890f632f4fab3580dae6fd81d886e387776a49e0956e7f804b9e371f99cc6b98fdef798a7b1ad78dea31d61a7cc3103cff25c8a4fa3ce98b41de1a316ed32336cbc365566b939ed17f9983f03272c6ea92295e2a2a1dfa68c82a3e735b29dd30103d22b724b0bef7f4f523978fc048326a38dcdf323502818100b7f2dda58a8e5e2bb84904a67c583a5260c08cbac03a9e78c9604a30780fabe4e87c759625359f793a08c38168926c553aa379de8bd14bc277cbf7ca98bcf705fad2e8a73d33a908e18082eccc4bb095dba6a388977d67b099b572e9dc8f4d07452920a2050faa9c5a619ecee982a1c831dea50344d019741de2a86e36cfdfab0281805ae19435c011235825323df2a8b20b1e3523bd9633b4ae6664edbdadf448f77fdfb6929bfdca02ad811a0e3f8361ffc5b420e359c6f46af033793962d442f2c0cb4cf8df27fc0839457c3b57fcc159fe04d94dd26c2606da23dc4f114f918e3343f35bcb64432ee08488e7c59395e4fdaa0975ae4a00a8166f172596e1e8941502818022f2863fa422462be2382525082caeefe5a7cf54cf9e936af93f4cf906665bcf02885ac2aad1143a30d76765579bb1ef4353b99c994dab2a081e7d36456c6935fea041493cac6ae9e005cd59f5ba4f933906e0bcdba31ca7059cde7725cb27e440b47e99a9827f74730b66e382a3a9dee1f29dc1103ac50b357e5167970c493f02818100b5b0830675cde996bd1f3060b5be3fd776921658057ec3fb521d9eb6d129566aeb4e80b520a03ebbb6c98e78cedf63ea921a86cf8121fcdfd1d54109f46a4d266e135fea75c5fde8a5fcd6c3e7f3e79b00fd467cf322dd7329c38459fa4dda49e3f2194162d6da56bd6a2928d40f2a9e2f435646fec1c2c8af16870bd5481a4f"
}

let api = new Api(
  "https://backendb.svc.icure.cloud/rest/v1",
  {
    Authorization: `Basic ${Buffer.from(
      `${"tz-dev-master-615cd8f9-4951-409b-87d8-116378c66f16/b036be3f-eae6-486f-8bb7-d4319370e8c6"}:${"Ztf993pf"}`
    ).toString("base64")}`
  },
  fetch as any
)

let mhapi = new Api(
  "https://backendb.svc.icure.cloud/rest/v1",
  {
    Authorization: `Basic ${Buffer.from(
      `${"tz-dev-master-615cd8f9-4951-409b-87d8-116378c66f16/371279d6-cfdb-4ee8-b36d-b1ccb9b8568d"}:${"Ztf993pf"}`
    ).toString("base64")}`
  },
  fetch as any
)

async function initKeys(api: Api, user: UserDto) {
  let id = user.healthcarePartyId
  while (id) {
    await api.cryptoicc
      .loadKeyPairsAsTextInBrowserLocalStorage(id, api.cryptoicc.utils.hex2ua(privateKeys[id]))
      .catch(error => {
        console.error("Error: in loadKeyPairsAsTextInBrowserLocalStorage")
        console.error(error)
      })

    id = (await api.hcpartyicc.getHealthcareParty(id)).parentId
  }
}

describe("Init confidential delegation in patient", () => {
  it("should return a patient with a confidential delegation", async () => {
    try {
      const user = await api.usericc.getCurrentUser()
      await initKeys(api, user)

      const pat = await api.patienticc.newInstance(user, { firstName: "John", lastName: "Doe" })
      const modifiedPatient = await api.patienticc.initConfidentialDelegation(pat, user)

      const confidentialDelegationKey = await api.cryptoicc.extractPreferredSfk(
        pat,
        user.healthcarePartyId,
        true
      )
      const nonConfidentialDelegationKey = await api.cryptoicc.extractPreferredSfk(
        pat,
        user.healthcarePartyId,
        false
      )

      expect(confidentialDelegationKey === nonConfidentialDelegationKey).to.equal(false)
    } catch (e) {
      console.log(e)
    }
  })
})

describe("test that confidential helement information cannot be retrieved at MH level", () => {
  it("should find the confidential data only when logged as the user", async () => {
    try {
      const user = await api.usericc.getCurrentUser()
      const mhUser = await mhapi.usericc.getCurrentUser()
      await initKeys(api, user)
      await initKeys(mhapi, mhUser)

      const pat = await api.patienticc.newInstance(user, { firstName: "John", lastName: "Doe" })
      const modifiedPatient = (await api.patienticc.initConfidentialDelegation(pat, user))!!

      await api.helementicc.createHealthElement(
        await api.helementicc.newInstance(
          user,
          modifiedPatient,
          { descr: "Confidential info" },
          true
        )
      )

      const retrievedHesAsUser = await api.helementicc.findBy(
        user.healthcarePartyId,
        modifiedPatient
      )
      const retrievedHesAsMh = await mhapi.helementicc.findBy(
        mhUser.healthcarePartyId,
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
      const user = await api.usericc.getCurrentUser()
      const mhUser = await mhapi.usericc.getCurrentUser()
      await initKeys(api, user)
      await initKeys(mhapi, mhUser)

      const pat = await api.patienticc.newInstance(user, { firstName: "John", lastName: "Doe" })
      const modifiedPatient = (await api.patienticc.initConfidentialDelegation(pat, user))!!

      await api.contacticc.createContactWithUser(
        user,
        await api.helementicc.newInstance(
          user,
          modifiedPatient,

          { descr: "Confidential info", services: [], subContacts: [] },
          true
        )
      )

      await api.contacticc.createContactWithUser(
        user,
        await api.helementicc.newInstance(
          user,
          modifiedPatient,

          { descr: "Non confidential info", services: [], subContacts: [] },
          false
        )
      )

      const retrievedCtcsAsUser = await api.contacticc.findBy(
        user.healthcarePartyId,
        modifiedPatient
      )
      const retrievedCtcsAsMh = await mhapi.contacticc.findBy(
        mhUser.healthcarePartyId,
        modifiedPatient
      )

      expect(retrievedCtcsAsUser.length).to.equal(2, "User should see its confidential data")
      expect(retrievedCtcsAsMh.length).to.equal(1, "MH should not see confidential data")
    } catch (e) {
      console.log(e)
    }
  })
})
