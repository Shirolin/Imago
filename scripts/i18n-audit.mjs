import fs from "fs";
import path from "path";
import { globSync } from "glob";

const LOCALES_DIR = "src/locales";
const SRC_DIR = "src";
const BASES = ["zh-CN.json", "en.json"];

// 展平 JSON
function flatten(obj, prefix = "") {
  return Object.keys(obj).reduce((acc, k) => {
    const pre = prefix.length ? prefix + "." : "";
    if (typeof obj[k] === "object" && obj[k] !== null && !Array.isArray(obj[k])) {
      Object.assign(acc, flatten(obj[k], pre + k));
    } else {
      acc[pre + k] = obj[k];
    }
    return acc;
  }, {});
}

// 从代码中提取 t() 的 key
function extractKeysFromCode() {
  const files = globSync(`${SRC_DIR}/**/*.{vue,ts}`);
  const keys = new Set();
  // 匹配 t('key') 或 t("key")，支持可选的第二个参数，使用 \b 确保不匹配 import() 等
  const regex = /\bt\(['"]([^'"]+)['"](?:\s*,|\s*\))/g;

  files.forEach(file => {
    const content = fs.readFileSync(file, "utf8");
    let match;
    while ((match = regex.exec(content)) !== null) {
      // 过滤掉动态拼接的 key (带 ${} 的通常匹配不到，但这里是正则提取)
      if (!match[1].includes("${")) {
        keys.add(match[1]);
      }
    }
  });
  return keys;
}

async function audit() {
  const files = fs.readdirSync(LOCALES_DIR).filter(f => f.endsWith(".json"));
  const data = {};
  
  files.forEach(file => {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, file), "utf8"));
      data[file] = flatten(content);
    } catch (e) {
      console.error(`❌ 无法解析文件 ${file}: ${e.message}`);
      process.exit(1);
    }
  });

  const codeKeys = extractKeysFromCode();
  const baseKeys = new Set();
  BASES.forEach(base => {
    if (data[base]) {
      Object.keys(data[base]).forEach(k => baseKeys.add(k));
    }
  });

  // 合并代码中发现的 key 到基准中
  codeKeys.forEach(k => baseKeys.add(k));

  console.log(`\n🔍 i18n 深度审计报告\n` + "=".repeat(50));
  console.log(`代码中提取到唯一键位: ${codeKeys.size}`);
  console.log(`基准文件合并后总键位: ${baseKeys.size}`);

  let hasMajorError = false;

  files.forEach(file => {
    const missingInFile = Array.from(baseKeys).filter(k => !data[file][k]);
    if (missingInFile.length > 0) {
      console.log(`\n🌐 语言包: ${file}`);
      console.log(`  ❌ 缺失键位 (${missingInFile.length}):`);
      // 只显示前 20 个，防止刷屏
      missingInFile.slice(0, 20).forEach(k => console.log(`     - ${k}`));
      if (missingInFile.length > 20) console.log(`     ... 还有 ${missingInFile.length - 20} 个`);
      hasMajorError = true;
    } else {
      console.log(`\n🌐 语言包: ${file} ✅ 已涵盖所有已知键位`);
    }
  });

  console.log("\n" + "=".repeat(50));
  if (hasMajorError) {
    console.log("❌ 审计未通过：发现源代码引用的键位在语言包中缺失。");
    // 将所有缺失的键位汇总输出到一个文件
    const summary = {};
    files.forEach(file => {
      const missing = Array.from(baseKeys).filter(k => !data[file][k]);
      if (missing.length) summary[file] = missing;
    });
    fs.writeFileSync("i18n-missing-report.json", JSON.stringify(summary, null, 2));
    console.log("📝 详细缺失列表已导出至: i18n-missing-report.json");
    process.exit(1);
  } else {
    console.log("✨ 审计通过：语言包已覆盖源代码中的所有引用。");
  }
}

audit();
