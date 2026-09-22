import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";

const execFileAsync = promisify(execFile);

// Rutas por defecto
const DEFAULT_INPUT_DIR = "/Users/andresf/Downloads/COMPRIMIDAS";
const DEFAULT_OUTPUT_DIR = "/Users/andresf/Downloads/COMPRIMIDAS_SIN_FONDO";
const REMOVE_BG_BIN = path.resolve("scripts/remove_bg");

const inputDir = process.argv[2] || DEFAULT_INPUT_DIR;
const outputDir = process.argv[3] || DEFAULT_OUTPUT_DIR;

if (!fs.existsSync(inputDir)) {
  console.error(`❌ Carpeta de entrada no encontrada: ${inputDir}`);
  process.exit(1);
}

if (!fs.existsSync(REMOVE_BG_BIN)) {
  console.error(`❌ Binario de recorte no encontrado: ${REMOVE_BG_BIN}`);
  console.error("Compílalo con: swiftc -O scripts/remove_bg.swift -o scripts/remove_bg");
  process.exit(1);
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const tempDir = path.join(outputDir, ".tmp_processing");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Obtener todas las fotos
const files = fs
  .readdirSync(inputDir)
  .filter((f) => /\.(jpe?g|png)$/i.test(f) && !f.startsWith("."))
  .sort();

console.log("=================================================");
console.log("🍔 PROCESADOR DE IMÁGENES DE MENÚ - LA 30");
console.log("=================================================");
console.log(`📁 Carpeta Origen:  ${inputDir}`);
console.log(`📁 Carpeta Destino: ${outputDir}`);
console.log(`🖼️  Total imágenes encontradas: ${files.length}`);
console.log("⚙️  Procesando: Remoción de fondo IA + Recorte + WebP 700x700");
console.log("-------------------------------------------------\n");

let totalOriginalBytes = 0;
let totalProcessedBytes = 0;
let successCount = 0;
let skippedCount = 0;
let errorCount = 0;

const TARGET_SIZE = 700; // 700x700 px (óptimo para pantallas móviles Retina)

for (let i = 0; i < files.length; i++) {
  const file = files[i];
  const inputFilePath = path.join(inputDir, file);
  const baseName = path.parse(file).name;
  const outputFileName = `${baseName}.webp`;
  const outputFilePath = path.join(outputDir, outputFileName);
  const tempPngPath = path.join(tempDir, `${baseName}_temp.png`);

  const stat = fs.statSync(inputFilePath);
  totalOriginalBytes += stat.size;

  const progress = `[${String(i + 1).padStart(2, " ")}/${files.length}]`;

  if (fs.existsSync(outputFilePath)) {
    const outStat = fs.statSync(outputFilePath);
    totalProcessedBytes += outStat.size;
    skippedCount++;
    console.log(`${progress} ⏩ ${file} ya procesado (${(outStat.size / 1024).toFixed(1)} KB)`);
    continue;
  }

  process.stdout.write(`${progress} ⏳ Procesando ${file}... `);
  const startTime = Date.now();

  try {
    // 1. Quitar fondo con Apple Vision Neural Engine
    await execFileAsync(REMOVE_BG_BIN, [inputFilePath, tempPngPath]);

    // 2. Optimizar con sharp:
    // - trim: elimina bordes transparentes sobrantes
    // - resize: ajusta a 700x700 dentro de un lienzo transparente centrado
    // - webp: compresión ultra eficiente con canal alfa
    const webpBuffer = await sharp(tempPngPath)
      .trim()
      .resize(TARGET_SIZE, TARGET_SIZE, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: 85, effort: 4 })
      .toBuffer();

    fs.writeFileSync(outputFilePath, webpBuffer);

    // Limpiar archivo temporal
    if (fs.existsSync(tempPngPath)) {
      fs.unlinkSync(tempPngPath);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const sizeKb = (webpBuffer.length / 1024).toFixed(1);
    totalProcessedBytes += webpBuffer.length;
    successCount++;

    console.log(`✅ ${outputFileName} (${sizeKb} KB) en ${elapsed}s`);
  } catch (err) {
    errorCount++;
    console.log(`❌ Error: ${err.message}`);
    if (fs.existsSync(tempPngPath)) {
      try {
        fs.unlinkSync(tempPngPath);
      } catch {}
    }
  }
}

// Limpiar carpeta temporal
try {
  fs.rmdirSync(tempDir);
} catch {}

const origMb = (totalOriginalBytes / (1024 * 1024)).toFixed(1);
const procMb = (totalProcessedBytes / (1024 * 1024)).toFixed(1);
const reduction =
  totalOriginalBytes > 0
    ? (((totalOriginalBytes - totalProcessedBytes) / totalOriginalBytes) * 100).toFixed(1)
    : 0;

console.log("\n=================================================");
console.log("🎉 PROCESAMIENTO COMPLETADO");
console.log("=================================================");
console.log(`✅ Exitosas:  ${successCount}`);
console.log(`⏩ Omitidas:  ${skippedCount}`);
console.log(`❌ Fallidas:  ${errorCount}`);
console.log(`📦 Peso original:     ${origMb} MB`);
console.log(`🚀 Peso final WebP:   ${procMb} MB (-${reduction}% de ahorro)`);
console.log(`📂 Carpeta lista en:  ${outputDir}`);
console.log("=================================================\n");
