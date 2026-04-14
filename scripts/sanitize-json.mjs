import fs from "fs";
import path from "path";

const dir = "src/locales";
fs.readdirSync(dir).forEach(file => {
  if (file.endsWith(".json")) {
    const p = path.join(dir, file);
    let content = fs.readFileSync(p, "utf8").trim();
    
    // 强制截断到最后一个 }
    const lastBrace = content.lastIndexOf("}");
    if (lastBrace !== -1) {
      content = content.substring(0, lastBrace + 1);
    }

    try {
      const data = JSON.parse(content);
      fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
      console.log(`✅ ${file} 已修复并格式化`);
    } catch (e) {
      console.error(`❌ ${file} 解析失败: ${e.message}`);
    }
  }
});
