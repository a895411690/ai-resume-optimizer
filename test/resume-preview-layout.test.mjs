import assert from "node:assert/strict";
import test from "node:test";
import { renderResumePreviewMarkdown } from "../src/lib/resume-preview-layout.js";

test("renders leading profile section as compact contact line", () => {
  const input = `# 张三

## 个人信息
- **电话**：13800138000
- **邮箱**：zhangsan@example.com
- **现居地**：上海
- **求职意向**：产品经理

## 教育经历
**2020.09 - 2024.06** 复旦大学 本科`;

  const layout = renderResumePreviewMarkdown(input);

  assert.equal(layout.title, "张三");
  assert.deepEqual(layout.contactItems, [
    "电话：13800138000",
    "邮箱：zhangsan@example.com",
    "现居地：上海",
    "求职意向：产品经理",
  ]);
  assert.equal(layout.bodyMarkdown.includes("## 个人信息"), false);
  assert.equal(layout.bodyMarkdown.includes("## 教育经历"), true);
});

test("keeps non-leading profile sections in the body", () => {
  const input = `# 张三

## 项目经历
### 数据看板
- 负责指标体系搭建

## 个人信息
- **电话**：13800138000`;

  const layout = renderResumePreviewMarkdown(input);

  assert.equal(layout.title, "张三");
  assert.deepEqual(layout.contactItems, []);
  assert.equal(layout.bodyMarkdown.includes("## 个人信息"), true);
});
