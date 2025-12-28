// faceDetection.ts
import * as FileSystem from "expo-file-system";
// @ts-ignore - expo-image-manipulator types may not be available
import * as ImageManipulator from "expo-image-manipulator";
// @ts-ignore - @tensorflow/tfjs types may not be available
import * as tf from "@tensorflow/tfjs";
// @ts-ignore
import "@tensorflow/tfjs-react-native";
// @ts-ignore
import { decodeJpeg } from "@tensorflow/tfjs-react-native";
// @ts-ignore - @tensorflow-models/face-detection types may not be available
import * as faceDetection from "@tensorflow-models/face-detection";
import { setupTensorFlowPlatform } from "./tfjs-platform-setup";

let detector: faceDetection.FaceDetector | null = null;
let tfReady = false;

export type FaceBox = { x: number; y: number; width: number; height: number };

async function ensureTfReady() {
  if (tfReady) return;
  // Setup platform first (polyfills react-native-fs)
  await setupTensorFlowPlatform();
  await tf.ready();
  tfReady = true;
}

async function getDetector() {
  if (detector) return detector;

  // MediaPipe runtime (free) – runs on-device
  const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
  const config: faceDetection.MediaPipeFaceDetectorTfjsModelConfig = {
    runtime: "tfjs",
    maxFaces: 1,
    modelType: "short", // faster, good enough for MVP
  };

  detector = await faceDetection.createDetector(model, config);
  return detector;
}

/**
 * For consistent detection, resize to a reasonable max size (keeps speed stable).
 * Returns newUri + scale factors so we can map box back to original.
 */
async function normalizeImage(uri: string) {
  // read image size using manipulator (cheap)
  const info = await ImageManipulator.manipulateAsync(uri, [], { compress: 1, format: ImageManipulator.SaveFormat.JPEG });
  // Unfortunately manipulator doesn't expose width/height here reliably across platforms without actions.
  // We'll just resize to a max width of 512 and rely on returned width/height from the resize result.
  const resized = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 512 } }],
    { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
  );

  return resized.uri;
}

export async function detectFaceBoxFromUri(originalUri: string): Promise<FaceBox | null> {
  await ensureTfReady();
  const det = await getDetector();

  // Resize for stable & fast detection
  const resizedUri = await normalizeImage(originalUri);

  // tfjs-react-native decode
  // @ts-ignore - EncodingType may not be in types
  const imgB64 = await FileSystem.readAsStringAsync(resizedUri, { encoding: FileSystem.EncodingType?.Base64 || 'base64' });
  const imgBuffer = tf.util.encodeString(imgB64, "base64").buffer as ArrayBuffer;
  const raw = new Uint8Array(imgBuffer);
  const imageTensor = decodeJpeg(raw);

  try {
    const faces = await det.estimateFaces(imageTensor, { flipHorizontal: false });
    if (!faces || faces.length === 0) return null;

    const box = faces[0].box; // {xMin, yMin, width, height}

    // IMPORTANT:
    // Since we resized the image for detection, you should analyze the SAME resized image on server OR map back.
    // Easiest MVP: upload the same resized image used for detection.
    // So we return faceBox in resized-image coordinates.
    return {
      x: Math.max(0, Math.floor(box.xMin)),
      y: Math.max(0, Math.floor(box.yMin)),
      width: Math.max(1, Math.floor(box.width)),
      height: Math.max(1, Math.floor(box.height)),
    };
  } finally {
    imageTensor.dispose();
  }
}
