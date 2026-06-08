import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanModelMarkdown,
  normalizeResumeMarkdown,
} from "../src/lib/resume-formatting.js";

test("normalizes mainstream plain-text resume sections into markdown", () => {
  const input = `姓名：张三
电话：13800138000
邮箱：zhangsan@example.com
求职意向：产品经理

教育经历
2020.09-2024.06 浙江大学 本科 计算机科学

项目经历
会员转化提升项目
负责用户访谈，整理反馈并输出页面优化建议
协同设计、研发完成页面迭代`;

  const output = normalizeResumeMarkdown(input);

  assert.match(output, /^# 张三/m);
  assert.match(output, /^- \*\*电话\*\*：13800138000/m);
  assert.match(output, /^- \*\*邮箱\*\*：zhangsan@example\.com/m);
  assert.match(output, /^- \*\*求职意向\*\*：产品经理/m);
  assert.match(output, /^## 教育经历/m);
  assert.match(output, /^\*\*2020\.09 - 2024\.06\*\* 浙江大学 本科 计算机科学/m);
  assert.match(output, /^## 项目经历/m);
  assert.match(output, /^### 会员转化提升项目/m);
  assert.match(output, /^- 负责用户访谈，整理反馈并输出页面优化建议/m);
  assert.match(output, /^- 协同设计、研发完成页面迭代/m);
  assert.doesNotMatch(output, /^### 协同设计、研发完成页面迭代/m);
});

test("preserves valid markdown and does not duplicate contact punctuation", () => {
  const input = `# 张三

## 个人信息
- **电话**：13800138000
- **邮箱**：zhangsan@example.com

## 工作经历
### 某科技公司｜运营专员｜2023.07 - 至今
- 负责用户增长活动。`;

  const output = normalizeResumeMarkdown(input);

  assert.equal((output.match(/电话：：/g) || []).length, 0);
  assert.match(output, /^- \*\*电话\*\*：13800138000/m);
  assert.match(output, /^### 某科技公司｜运营专员｜2023\.07 - 至今/m);
});

test("cleans common model markdown wrappers before previewing optimized resumes", () => {
  const input = `以下是优化后的简历：

\`\`\`markdown
# 李四

## 技能
SQL｜Python｜数据分析
\`\`\``;

  const output = cleanModelMarkdown(input);

  assert.equal(output.startsWith("# 李四"), true);
  assert.equal(output.includes("```"), false);
  assert.equal(output.includes("以下是优化后的简历"), false);
  assert.match(output, /^## 技能/m);
});

test("splits one-line contact summaries into profile bullets", () => {
  const input = `张三 | 13800138000 | zhangsan@example.com | 上海 | 产品经理

工作经历
某科技公司｜产品经理｜2022.03-至今
负责用户增长策略设计，推动核心转化路径优化`;

  const output = normalizeResumeMarkdown(input);

  assert.match(output, /^# 张三/m);
  assert.match(output, /^## 个人信息/m);
  assert.match(output, /^- \*\*电话\*\*：13800138000/m);
  assert.match(output, /^- \*\*邮箱\*\*：zhangsan@example\.com/m);
  assert.match(output, /^- \*\*现居地\*\*：上海/m);
  assert.match(output, /^- \*\*求职意向\*\*：产品经理/m);
});

test("normalizes English and mixed-language section aliases", () => {
  const input = `# Alice Zhang

Education
2020/09 - 2024/06 Fudan University Bachelor Computer Science

Experience
ByteDance | Data Analyst | 2024.07 - Present
Built weekly metric dashboards for growth review

Projects
Retention Dashboard
Analyzed cohort retention and delivered SQL-based reports

Skills
SQL / Python / Tableau / Excel`;

  const output = normalizeResumeMarkdown(input);

  assert.match(output, /^# Alice Zhang/m);
  assert.match(output, /^## 教育经历/m);
  assert.match(output, /^\*\*2020\.09 - 2024\.06\*\* Fudan University Bachelor Computer Science/m);
  assert.match(output, /^## 工作经历/m);
  assert.match(output, /^### ByteDance \| Data Analyst \| 2024\.07 - Present/m);
  assert.match(output, /^- Built weekly metric dashboards for growth review/m);
  assert.match(output, /^## 项目经历/m);
  assert.match(output, /^### Retention Dashboard/m);
  assert.match(output, /^## 技能/m);
  assert.match(output, /^- SQL \/ Python \/ Tableau \/ Excel/m);
});

test("keeps skill lists as bullets instead of experience titles", () => {
  const input = `# 李四

专业技能
Java / Spring Boot / MySQL / Redis / Kubernetes
数据分析：SQL、Python、Tableau

工作经历
某互联网公司｜后端工程师｜2021.04 - 2024.08
参与订单系统重构，降低接口平均响应时间`;

  const output = normalizeResumeMarkdown(input);

  assert.match(output, /^## 技能/m);
  assert.match(output, /^- Java \/ Spring Boot \/ MySQL \/ Redis \/ Kubernetes/m);
  assert.match(output, /^- 数据分析：SQL、Python、Tableau/m);
  assert.doesNotMatch(output, /^### Java \/ Spring Boot/m);
  assert.match(output, /^### 某互联网公司｜后端工程师｜2021\.04 - 2024\.08/m);
});

test("recovers structure from whitespace-collapsed imported resume text", () => {
  const input = "张三 个人信息 电话：13800138000 邮箱：zhangsan@example.com 现居地：上海 求职意向：产品经理 教育经历 2020.09-2024.06 复旦大学 本科 项目经历 会员转化提升项目 负责用户访谈，整理反馈并输出页面优化建议 协同设计、研发完成页面迭代";

  const output = normalizeResumeMarkdown(input);

  assert.match(output, /^# 张三/m);
  assert.match(output, /^## 个人信息/m);
  assert.match(output, /^- \*\*电话\*\*：13800138000/m);
  assert.match(output, /^- \*\*邮箱\*\*：zhangsan@example\.com/m);
  assert.match(output, /^- \*\*现居地\*\*：上海/m);
  assert.match(output, /^- \*\*求职意向\*\*：产品经理/m);
  assert.match(output, /^## 教育经历/m);
  assert.match(output, /^\*\*2020\.09 - 2024\.06\*\* 复旦大学 本科/m);
  assert.match(output, /^## 项目经历/m);
  assert.match(output, /^### 会员转化提升项目/m);
  assert.match(output, /^- 负责用户访谈，整理反馈并输出页面优化建议/m);
  assert.match(output, /^- 协同设计、研发完成页面迭代/m);
});

test("formats label-colon paragraphs from parsed PDF resumes", () => {
  const input = `工作背景： 拥有深厚的测试经验，涵盖传统银行、互联网金融等多个领域，熟练掌握贷前、贷后及核心账务系统测试。
团队管理： 具备20余人团队管理经验，擅长项目管理和团队协调。
团队合作： 具备出色的团队合作能力，优秀的执行力和积极主动精神。
工作荣誉： 曾获得最佳服务奖和优秀员工奖。
数据库操作与测试： 精通 SQL 查询、数据校验和接口测试。`;

  const output = normalizeResumeMarkdown(input);

  assert.match(output, /^## 工作背景/m);
  assert.match(output, /^- 拥有深厚的测试经验，涵盖传统银行、互联网金融等多个领域/m);
  assert.match(output, /^## 团队管理/m);
  assert.match(output, /^- 具备20余人团队管理经验，擅长项目管理和团队协调。/m);
  assert.match(output, /^## 团队合作/m);
  assert.match(output, /^## 工作荣誉/m);
  assert.match(output, /^## 数据库操作与测试/m);
  assert.doesNotMatch(output, /^工作背景：/m);
});

test("splits multiple label-colon paragraphs embedded on one parsed line", () => {
  const input = "工作背景： 拥有深厚的测试经验，确保产品稳定上线。 团队管理： 具备20余人团队管理经验，擅长项目管理和团队协调。 团队合作： 具备出色的团队合作能力，能够推动项目高质量完成。 工作荣誉： 曾获得最佳服务奖。";

  const output = normalizeResumeMarkdown(input);

  assert.match(output, /^## 工作背景/m);
  assert.match(output, /^- 拥有深厚的测试经验，确保产品稳定上线。/m);
  assert.match(output, /^## 团队管理/m);
  assert.match(output, /^- 具备20余人团队管理经验，擅长项目管理和团队协调。/m);
  assert.match(output, /^## 团队合作/m);
  assert.match(output, /^## 工作荣誉/m);
  assert.doesNotMatch(output, /团队管理： 具备20余人团队管理经验/);
});

test("splits embedded label paragraphs separated by wide spacing", () => {
  const input = "数据库操作与测试： 精通数据库操作，具备数据迁移测试经验  持续集成与自动化部署： 熟练掌握Jenkins持续集成工具  系统监控与日志分析： 熟练操作Linux命令，高效进行后台日志跟踪  测试工具应用： 精通Postman、Jmeter、Fiddler等主流测试工具";

  const output = normalizeResumeMarkdown(input);

  assert.match(output, /^## 数据库操作与测试/m);
  assert.match(output, /^## 持续集成与自动化部署/m);
  assert.match(output, /^## 系统监控与日志分析/m);
  assert.match(output, /^## 测试工具应用/m);
  assert.doesNotMatch(output, /持续集成与自动化部署： 熟练掌握Jenkins/);
});

test("splits wide-spaced project title role and dates from imported PDF paragraphs", () => {
  const input = "自动化测试： 熟练掌握自动化测试方法，高效开展回归测试及冒烟测试  零售信贷核心重构及企业级架构项目   高级测试工程师   2023.02 - 2025.01 项目描述： 交通银行启动零售信贷核心重构项目";

  const output = normalizeResumeMarkdown(input);

  assert.match(output, /^## 自动化测试/m);
  assert.match(output, /^- 熟练掌握自动化测试方法，高效开展回归测试及冒烟测试$/m);
  assert.match(output, /^### 零售信贷核心重构及企业级架构项目｜高级测试工程师｜2023\.02 - 2025\.01$/m);
  assert.match(output, /^## 项目描述/m);
  assert.match(output, /^- 交通银行启动零售信贷核心重构项目$/m);
  assert.doesNotMatch(output, /回归测试及冒烟测试\s+零售信贷核心重构/);
});

test("splits plain-spaced project title role and dates after achievement bullets", () => {
  const input = "团队协作与项目管理： 有效协调团队资源，确保项目测试进度与质量双达标。 广发信用卡新核心项目 测试组长 2022.10 - 2023.01 项目描述： 该项目为广发信用卡大机核心优化升级项目";

  const output = normalizeResumeMarkdown(input);

  assert.match(output, /^## 团队协作与项目管理/m);
  assert.match(output, /^- 有效协调团队资源，确保项目测试进度与质量双达标。$/m);
  assert.match(output, /^### 广发信用卡新核心项目｜测试组长｜2022\.10 - 2023\.01$/m);
  assert.match(output, /^## 项目描述/m);
  assert.match(output, /^- 该项目为广发信用卡大机核心优化升级项目$/m);
  assert.doesNotMatch(output, /质量双达标。\s+广发信用卡新核心项目/);
});

test("splits standalone section labels that were appended after PDF bullets", () => {
  const input = "自动化测试： 进行自动化UI及接口测试，覆盖回归测试范围，显著提高测试质量，保障生产验收顺利进行。 自我评价 专业技能 项目经验 卫家豪 13311667685 895411690@qq.com 男 8年工作经验 求职意向：测试工程师";

  const output = normalizeResumeMarkdown(input);

  assert.match(output, /^## 自动化测试/m);
  assert.match(output, /^- 进行自动化UI及接口测试，覆盖回归测试范围，显著提高测试质量，保障生产验收顺利进行。$/m);
  assert.match(output, /^## 自我评价/m);
  assert.match(output, /^## 技能/m);
  assert.match(output, /^## 项目经历/m);
  assert.doesNotMatch(output, /顺利进行。\s+自我评价 专业技能 项目经验/);
});

test("splits trailing education sections from imported PDF achievement lines", () => {
  const input = "测试覆盖率提升： 通过细致的测试计划和用例设计，使测试覆盖率提升至98%，显著提高产品质量。 北京理工大学 本科 计算机科学与技术 2019.03 - 2022.07 上海开放大学 专科 行政管理 2014.09 - 2017.07 教育经历";

  const output = normalizeResumeMarkdown(input);

  assert.match(output, /^## 测试覆盖率提升/m);
  assert.match(output, /^- 通过细致的测试计划和用例设计，使测试覆盖率提升至98%，显著提高产品质量。$/m);
  assert.match(output, /^## 教育经历/m);
  assert.match(output, /^### 北京理工大学 本科 计算机科学与技术 2019\.03 - 2022\.07/m);
  assert.match(output, /^### 上海开放大学 专科 行政管理 2014\.09 - 2017\.07/m);
  assert.doesNotMatch(output, /产品质量。\s+北京理工大学/);
});

test("keeps result sentences beginning with through as bullets before project titles", () => {
  const input = "版本质量保障： 通过问题汇总分析输出版本质量评估报告，支持线上验收，提供优化建议，有效保障版本质量。 美团联名卡新核心项目 测试开发工程师 2021.04 - 2022.05 项目描述： 打造新一代信用卡核心系统群";

  const output = normalizeResumeMarkdown(input);

  assert.match(output, /^## 版本质量保障/m);
  assert.match(output, /^- 通过问题汇总分析输出版本质量评估报告，支持线上验收，提供优化建议，有效保障版本质量。$/m);
  assert.match(output, /^### 美团联名卡新核心项目｜测试开发工程师｜2021\.04 - 2022\.05$/m);
  assert.doesNotMatch(output, /^### 通过问题汇总/m);
});

test("reformats partially normalized markdown with appended section labels", () => {
  const input = `## 自动化测试
- 进行自动化UI及接口测试，覆盖回归测试范围，显著提高测试质量，保障生产验收顺利进行。 自我评价 专业技能 项目经验 卫家豪 13311667685 895411690@qq.com 男 8年工作经验 求职意向：测试工程师`;

  const output = normalizeResumeMarkdown(input);

  assert.match(output, /^- 进行自动化UI及接口测试，覆盖回归测试范围，显著提高测试质量，保障生产验收顺利进行。$/m);
  assert.match(output, /^## 自我评价/m);
  assert.match(output, /^## 技能/m);
  assert.match(output, /^## 项目经历/m);
  assert.doesNotMatch(output, /顺利进行。\s+自我评价 专业技能 项目经验/);
});

test("reformats partially normalized markdown with trailing education entries", () => {
  const input = `## 测试覆盖率提升
- 通过细致的测试计划和用例设计，使测试覆盖率提升至98%，显著提高产品质量。 北京理工大学 本科 计算机科学与技术 2019.03 - 2022.07 上海开放大学 专科 行政管理 2014.09 - 2017.07 教育经历`;

  const output = normalizeResumeMarkdown(input);

  assert.match(output, /^- 通过细致的测试计划和用例设计，使测试覆盖率提升至98%，显著提高产品质量。$/m);
  assert.match(output, /^## 教育经历/m);
  assert.match(output, /^### 北京理工大学 本科 计算机科学与技术 2019\.03 - 2022\.07/m);
  assert.match(output, /^### 上海开放大学 专科 行政管理 2014\.09 - 2017\.07/m);
  assert.doesNotMatch(output, /产品质量。\s+北京理工大学/);
});

test("demotes existing action-result headings produced by earlier parsing", () => {
  const input = `## 版本质量保障
### 通过问题汇总分析输出版本质量评估报告，支持线上验收，提供优化建议，有效保障版本质量。
### 美团联名卡新核心项目｜测试开发工程师｜2021.04 - 2022.05`;

  const output = normalizeResumeMarkdown(input);

  assert.match(output, /^- 通过问题汇总分析输出版本质量评估报告，支持线上验收，提供优化建议，有效保障版本质量。$/m);
  assert.match(output, /^### 美团联名卡新核心项目｜测试开发工程师｜2021\.04 - 2022\.05$/m);
  assert.doesNotMatch(output, /^### 通过问题汇总/m);
});

test("recovers section labels and education entries from previously saved normalized markdown", () => {
  const input = `## 自我评价
- 项目经验  卫家豪  13311667685   895411690@qq.com 男  8年工作经验   求职意向：测试工程师

## 版本质量保障
- 通过问题汇总分析输出版本质量评估报告，支持线上验收，提供优化建议，有效保障版本质
- 量。

## 教育经历
- 北京理工大学   本科   计算机科学与技术   2019.03 - 2022.07  上海开放大学   专科   行政管理   2014.09 - 2017.07`;

  const output = normalizeResumeMarkdown(input);

  assert.match(output, /^## 项目经历/m);
  assert.match(output, /^- 卫家豪  13311667685   895411690@qq.com 男  8年工作经验$/m);
  assert.match(output, /^- \*\*求职意向\*\*：测试工程师$/m);
  assert.match(output, /^- 通过问题汇总分析输出版本质量评估报告，支持线上验收，提供优化建议，有效保障版本质量。$/m);
  assert.match(output, /^### 北京理工大学 本科 计算机科学与技术 2019\.03 - 2022\.07$/m);
  assert.match(output, /^### 上海开放大学 专科 行政管理 2014\.09 - 2017\.07$/m);
  assert.doesNotMatch(output, /^- 量。$/m);
});

test("recovers short tail headings that also contain the next project title", () => {
  const input = `## 版本质量保障
- 通过问题汇总分析输出版本质量评估报告，支持线上验收，提供优化建议，有效保障版本质
### 量。  美团联名卡新核心项目｜测试开发工程师｜2021.04 - 2022.05`;

  const output = normalizeResumeMarkdown(input);

  assert.match(output, /^- 通过问题汇总分析输出版本质量评估报告，支持线上验收，提供优化建议，有效保障版本质量。$/m);
  assert.match(output, /^### 美团联名卡新核心项目｜测试开发工程师｜2021\.04 - 2022\.05$/m);
  assert.doesNotMatch(output, /heading/);
  assert.doesNotMatch(output, /^### 量。/m);
});
