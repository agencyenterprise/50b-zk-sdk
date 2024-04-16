import { execSync } from "child_process";
import fs from "fs";
import crypto from "crypto";
import { plonk } from "snarkjs";
import solc from "solc"


export function createJob() {
  return {
    jobId: "123",
    base64EnclavePublicKey:
      "LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUlJQklqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FROEFNSUlCQ2dLQ0FRRUE3cExRei9lMVo5eURLZUJJSC9ocwpEa0Fndmx3bktoYmpZT2Z0UlIxbjJsRTFMRlQrR0tSK1l0bk5qak5VREluY2M1Z0tVTFdqTmRXdzBYdWs4OFZUCnZRQ2dQL3NUZjRtUlAzL3E3RTgxdmZLNWU2VHliZ2JUbCtQVjVBbzd3aHJoblQzYmNKWGVubVZka1ZTUVJZV04KTEZ2cnJic2lXWmJKa1BwOFNmOEoxZzF0aURoWjJaSkUrWXJKT0hybXM5dmVvQXgrY3JLaHhlaFlLb3ppRUI4dwpaeEUwU1pqOEdtOXVmeVpmK3EvL3pqYTNKWTNrcFN5R3FmRUFPK2tHc1pFM0RJKzBoQmpVaWN1Ly91N0UxZFpXCjRQYlluOXZnUUxwSzN6a01XdjZiL3FqUHI2Ty94TGZsVCtxMXBZUmRXYUZneld0S2JvSDJERlY0eU9LWERRS0gKTXdJREFRQUIKLS0tLS1FTkQgUFVCTElDIEtFWS0tLS0t",
  };
}

export function startJob(
  jobId,
  base64R1cs,
  base64EncryptedWitness,
  base64EncryptedAesKey,
  base64AesIv
) {
  fs.writeFileSync(`info.json`, JSON.stringify({
    witness: base64EncryptedWitness,
    aesKey: base64EncryptedAesKey,
    aesIv: base64AesIv,
  }));
  console.log(`Generated data`);
}

function compileCircom(circuitPath) {
  execSync(`circom ${circuitPath} --r1cs --wasm -o ./output`);
}

function generateWitness(circuitName, inputsPath) {
  fs.writeFileSync(
    `./output/${circuitName}_js/package.json`,
    '{"type": "commonjs"}'
  );

  execSync(
    `node ./output/${circuitName}_js/generate_witness.js ./output/${circuitName}_js/${circuitName}.wasm ${inputsPath} ./output/${circuitName}.wtns`
  );
}

export async function generate50bZkArguments(circuitPath, inputsPath) {
  if (!fs.existsSync("./output")) {
    fs.mkdirSync("./output");
  }

  const circuitName = circuitPath.split("/").pop().split(".")[0];

  compileCircom(circuitPath);
  generateWitness(circuitName, inputsPath);

  const base64R1cs = fs
    .readFileSync(`./output/${circuitName}.r1cs`)
    .toString("base64");
  const base64Witness = fs
    .readFileSync(`./output/${circuitName}.wtns`)
    .toString("base64");

  generateSolidityContractVerifier(circuitName)
  deployVerifierContract(circuitName)

  fs.rmSync("./output", { recursive: true });

  return { base64R1cs, base64Witness };
}

export function encryptWitness(base64EnclavePublicKey, base64Witness) {
  const enclavePublicKey = Buffer.from(
    base64EnclavePublicKey,
    "base64"
  ).toString("utf-8");

  const aes_key = crypto.randomBytes(32);
  const aes_iv = crypto.randomBytes(16);
  const cipher_aes = crypto.createCipheriv("aes-256-cbc", aes_key, aes_iv);

  const base64EncryptedWitness = Buffer.concat([
    cipher_aes.update(Buffer.from(base64Witness, "utf8")),
    cipher_aes.final(),
  ]).toString("base64");

  const base64EncryptedAesKey = crypto
    .publicEncrypt(
      {
        key: enclavePublicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      aes_key
    )
    .toString("base64");

  return {
    base64EncryptedWitness,
    base64EncryptedAesKey,
    base64AesIv: aes_iv.toString("base64"),
  };
}

const generateSolidityContractVerifier = (circuitName) => {
  execSync(
    `snarkjs plonk setup output/${circuitName}.r1cs powersOfTau15_final.ptau output/${circuitName}.zKey`
  )

  execSync(
    `snarkjs zkey export solidityverifier output/${circuitName}.zKey output/verifier.sol`
  );
}

const deployVerifierContract = () => {
  const contractCode = fs.readFileSync("output/verifier.sol", 'utf8').replace(`import "hardhat/console.sol";`, "")

  const input = {
    language: 'Solidity',
    sources: {
      'verifier.sol': {
        content: contractCode
      }
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['*']
        }
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const contractBytecode = output.contracts['verifier.sol']['PlonkVerifier'].evm.bytecode.object

  console.log(contractBytecode)
}

