import {
  createJob,
  generate50bZkArguments,
  encryptWitness,
  startJob,
} from "./50b-zk-sdk.js";

const circuitPath = "./circuits/factor/factor.circom";
const inputsPath = "./circuits/factor/inputs.json";

const { jobId, base64EnclavePublicKey } = createJob();

const { base64R1cs, base64Witness } = generate50bZkArguments(
  circuitPath,
  inputsPath
);

const { base64EncryptedWitness, base64EncryptedAesKey, base64AesIv } =
  encryptWitness(base64EnclavePublicKey, base64Witness);

startJob(
  jobId,
  base64R1cs,
  base64EncryptedWitness,
  base64EncryptedAesKey,
  base64AesIv
);

// TODO: Poll Hub for the result using jobId

// TODO: Validate ZK proof result
