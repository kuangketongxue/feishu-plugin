import React, { useState } from "react";
import { bitable } from "@lark-base-open/js-sdk";
import { Button, Toast, Typography, Space, InputNumber } from "@douyinfe/semi-ui";

const { Title, Text } = Typography;

/**
 * 字段名称（必须和多维表格里完全一致）
 */
const FIELD_DATE = "日期";
const FIELD_CODE = "序号代码";

const REVIEW_FIELDS = [
  "今日复习-1",
  "今日复习-2",
  "今日复习-3",
  "今日复习-4",
  "今日复习-5",
  "今日复习-6",
  "今日复习-7",
];

// 复习间隔
const OFFSETS = [1, 2, 4, 7, 14, 21, 30];

const SEP = ";";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function dayStart(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeText(v) {
  if (!v) return "";
  return String(v).trim();
}

function splitTokens(text) {
  if (!text) return [];
  return text
    .split(SEP)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function getFieldIdByName(table, name) {
  const fields = await table.getFieldMetaList();
  const f = fields.find((x) => x.name === name);
  if (!f) throw new Error(`找不到字段：${name}`);
  return f.id;
}

export default function App() {
  const [loading, setLoading] = useState(false);
  const [maxDays, setMaxDays] = useState(365);

  async function fillReviewPlan() {
    setLoading(true);
    try {
      const table = await bitable.base.getActiveTable();

      const dateFieldId = await getFieldIdByName(table, FIELD_DATE);
      const codeFieldId = await getFieldIdByName(table, FIELD_CODE);

      const reviewFieldIds = [];
      for (const name of REVIEW_FIELDS) {
        reviewFieldIds.push(await getFieldIdByName(table, name));
      }

      const recordList = await table.getRecordList();

      // 建立 日期 → recordId 映射
      const dateMap = new Map();

      for (const r of recordList) {
        const v = await table.getCellValue(dateFieldId, r.id);
        if (!v) continue;
        const d = new Date(v);
        const key = formatDateKey(dayStart(d));
        dateMap.set(key, r.id);
      }

      let writeCount = 0;

      for (const r of recordList) {
        const codeVal = await table.getCellValue(codeFieldId, r.id);
        const code = normalizeText(codeVal);
        if (!code) continue;

        const dateVal = await table.getCellValue(dateFieldId, r.id);
        if (!dateVal) continue;

        const baseDate = dayStart(new Date(dateVal));

        for (let i = 0; i < OFFSETS.length; i++) {
          const offset = OFFSETS[i];
          if (offset > maxDays) continue;

          const targetDate = addDays(baseDate, offset);
          const key = formatDateKey(targetDate);

          let targetRecordId = dateMap.get(key);

          // 如果没有该日期行 → 创建
          if (!targetRecordId) {
            targetRecordId = await table.addRecord({});
            await sleep(50);
            await table.setCellValue(
              dateFieldId,
              targetRecordId,
              targetDate.getTime()
            );
            await sleep(50);
            dateMap.set(key, targetRecordId);
          }

          const fieldId = reviewFieldIds[i];

          const oldVal = await table.getCellValue(fieldId, targetRecordId);
          const oldText = normalizeText(oldVal);

          const tokens = splitTokens(oldText);
          if (!tokens.includes(code)) {
            const newText = oldText ? `${oldText}${SEP}${code}` : code;
            await table.setCellValue(fieldId, targetRecordId, newText);
            await sleep(50);
            writeCount++;
          }
        }
      }

      Toast.success(`✅ 完成，共写入 ${writeCount} 次`);
    } catch (err) {
      console.error(err);
      Toast.error(err.message || "执行失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <Title heading={5}>遗复自动化</Title>

      <Space vertical style={{ width: "100%" }}>
        <Text>复习间隔：1 / 2 / 4 / 7 / 14 / 21 / 30 天</Text>

        <div>
          <Text type="tertiary">未来最大创建范围：</Text>
          <InputNumber
            value={maxDays}
            min={1}
            max={2000}
            onChange={(v) => setMaxDays(v || 365)}
            suffix="天"
            style={{ width: 160, marginLeft: 8 }}
          />
        </div>

        <Button
          theme="solid"
          type="primary"
          loading={loading}
          onClick={fillReviewPlan}
          block
        >
          一键生成复习计划
        </Button>
      </Space>
    </div>
  );
}