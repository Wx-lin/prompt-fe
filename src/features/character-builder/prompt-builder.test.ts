import { describe, expect, it } from 'vitest';
import { GROUPS, TEMPLATES, createInitialValues } from './character-data';
import { buildOutputs, translateValue } from './prompt-builder';
import { BUILT_IN_PRESETS } from './character-presets';

describe('角色设定提示词', () => {
  it('初始角色的每一项都有默认值，非指定的补充项不会混入提示词', () => {
    const values = createInitialValues();
    const fields = GROUPS.flatMap(group => group.fields);
    expect(fields.filter(field => !values[field.id]?.trim()).map(field => field.id)).toEqual([]);
    expect(values.faceShape).toBe('鹅蛋脸');
    expect(values.hairColor).toBe('黑色');
    expect(values.hairLength).toBe('齐肩发');
    expect(values.height).toBe('168cm');
    expect(values.leftContent).toBe('三视图');
    const output = buildOutputs(values, 'basic', 'SDXL');
    expect(output.zh).toContain('鹅蛋脸');
    expect(output.zh).toContain('齐肩发');
    expect(output.zh).not.toContain('不指定');
    expect(output.negative).not.toContain('不指定');
    expect(output.parameters).not.toContain('不一致');
  });

  it('六类模板的默认输出都包含完整可用的角色信息和各自的用途', () => {
    const values = createInitialValues();
    const outputs = TEMPLATES.map(template => buildOutputs(values, template.id, '通用'));
    expect(new Set(outputs.map(output => output.zh)).size).toBe(TEMPLATES.length);
    for (const output of outputs) {
      expect(output.zh).toContain('新角色');
      expect(output.zh).toContain('运动背心');
      expect(output.zh).toContain('齐肩发');
      expect(output.zh).not.toContain('不指定');
      expect(output.en).not.toMatch(/[\u3400-\u9fff]/u);
    }
    expect(outputs[0].zh).toContain('背面');
    expect(outputs[2].zh).toContain('惊讶');
    expect(outputs[5].zh).toContain('4');
  });

  it('不同模板只使用适合其用途的布局、表情和景别，同时保留用户配置', () => {
    const values = createInitialValues();
    const still = buildOutputs(values, 'still', '通用').zh;
    expect(still).not.toContain('左侧三视图');
    expect(still).not.toContain('左侧内容：三视图');
    expect(still).not.toContain('表情：平静，微笑');
    expect(still).not.toContain('细节图数量');
    const expressions = buildOutputs(values, 'expressions', '通用').zh;
    expect(expressions).not.toContain('左侧三视图');
    expect(expressions).not.toContain('景别：全身');
    expect(expressions).toContain('表情：平静，微笑');
    const wardrobe = buildOutputs(values, 'wardrobe', '通用').zh;
    expect(wardrobe).not.toContain('左侧三视图');
    const storyboard = buildOutputs(values, 'storyboard', '通用').zh;
    expect(storyboard).not.toContain('左侧三视图');
    expect(storyboard).toContain('连续分镜数量：4');
    expect(buildOutputs(values, 'basic', '通用').zh).toContain('左侧三视图');
    expect(values.leftContent).toBe('三视图');
  });

  it('各处不指定占位不进入输出，多选保留其他值且自定义文字不受影响', () => {
    const values = { ...createInitialValues(), leftContent: '不指定', rightContent: '不指定', expressions: '不指定，微笑', detailTypes: '不指定，手部', personality: '不指定，温柔', marks: '不指定，眼角痣', negativeStrength: '不指定', negativeDetails: '不指定', description: '这位角色不会不指定方向' };
    const output = buildOutputs(values, 'basic', '通用');
    expect(output.zh).toContain('微笑');
    expect(output.zh).toContain('手部');
    expect(output.zh).toContain('性格标签：温柔');
    expect(output.zh).toContain('这位角色不会不指定方向');
    expect(output.zh).not.toContain('展示不指定');
    expect(output.zh).not.toContain('不指定，');
    expect(output.negative).not.toContain('不指定');
    expect(output.characterId).not.toContain('不指定');
    expect(values.detailTypes).toBe('不指定，手部');
    const empty = buildOutputs({ ...values, description: '', expressions: '不指定', detailTypes: '不指定' }, 'expressions', '通用');
    expect(empty.zh).not.toContain('不指定');
    const unspecifiedParameters = buildOutputs({ ...values, size: '不指定', aspectRatio: '不指定' }, 'basic', 'SDXL');
    expect(unspecifiedParameters.parameters).not.toContain('尺寸格式无效');
  });

  it('提供完整配置分组及模板，字段标识不重复', () => {
    expect(GROUPS).toHaveLength(17);
    expect(TEMPLATES).toHaveLength(6);
    const ids = GROUPS.flatMap(group => group.fields.map(field => field.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('shotCount');
    expect(ids).toContain('lockFace');
    expect(ids).toContain('seed');
  });

  it('保留用户自定义值，并按模板生成不同目的的提示词', () => {
    const values = { ...createInitialValues(), name: '林屿', eyeShape: '浅琥珀色瞳孔', shotCount: '6', lockFace: 'true' };
    const base = buildOutputs(values, 'basic', '通用');
    const storyboard = buildOutputs(values, 'storyboard', '通用');
    expect(base.zh).toContain('林屿');
    expect(base.zh).toContain('浅琥珀色瞳孔');
    expect(storyboard.zh).toContain('6');
    expect(storyboard.zh).not.toBe(base.zh);
    expect(base.en).toContain('浅琥珀色瞳孔');
    expect(base.bilingual).toContain(base.zh);
    expect(base.bilingual).toContain(base.en);
  });

  it('输出有效的分组 JSON，并提供模型参数与可选负面词', () => {
    const values = { ...createInitialValues(), negativeDetails: '模糊, 畸形手指', seed: '42', steps: '30' };
    const out = buildOutputs(values, 'three-view', 'SDXL');
    expect(out.negative).toContain('畸形手指');
    expect(out.parameters).toContain('42');
    expect(out.parameters).toContain('30');
    const exported = JSON.parse(out.json);
    expect(exported.values.negativeDetails).toBe('模糊, 畸形手指');
    expect(exported.template).toBe('three-view');
    expect(exported.model).toBe('SDXL');
  });

  it('关闭负面词或模型参数时不把它们追加到正文', () => {
    const values = { ...createInitialValues(), includeNegative: 'false', includeParameters: 'false', negativeDetails: '模糊', seed: '42' };
    const out = buildOutputs(values, 'basic', 'SDXL');
    expect(out.zh).not.toContain('模糊');
    expect(out.zh).not.toContain('Seed: 42');
    expect(out.negative).toContain('模糊');
  });

  it('关闭一致性和细节图时不会要求锁定脸部或展示细节图', () => {
    const values = { ...createInitialValues(), lockFace: 'false', includeDetails: 'false', detailTypes: '手部', includeCharacterId: 'false' };
    const out = buildOutputs(values, 'three-view', '通用');
    expect(out.zh).not.toContain('锁定脸型五官');
    expect(out.zh).not.toContain('细节类型：手部');
    expect(out.characterId).toBe('');
  });

  it('常用项有可选建议，同时可输入自定义内容', () => {
    const fields = GROUPS.flatMap(group => group.fields);
    expect(fields.find(field => field.id === 'occupation')?.options?.length).toBeGreaterThan(10);
    expect(fields.find(field => field.id === 'lighting')?.options?.length).toBeGreaterThan(5);
    const out = buildOutputs({ ...createInitialValues(), occupation: '星际造船师' }, 'still', 'Flux');
    expect(out.zh).toContain('星际造船师');
  });

  it('提供多元角色、造型和摄影场景的候选并可用于中英文提示词', () => {
    const fields = GROUPS.flatMap(group => group.fields);
    const optionsFor = (id: string) => fields.find(field => field.id === id)?.options ?? [];
    for (const [field, option] of [['occupation', '航天工程师'], ['hairStyle', '背头'], ['top', '飞行夹克'], ['scene', '地铁站'], ['lighting', '伦勃朗光']] as const) {
      expect(optionsFor(field)).toContain(option);
    }
    for (const field of ['temperament', 'height', 'eyelids', 'nails']) {
      expect(fields.find(item => item.id === field)?.type).toBe('select');
      expect(optionsFor(field).length).toBeGreaterThan(3);
    }
    const values = { ...createInitialValues(), occupation: '航天工程师', hairStyle: '背头', top: '飞行夹克', scene: '地铁站', lighting: '伦勃朗光' };
    const result = buildOutputs(values, 'still', '通用');
    expect(result.zh).toContain('航天工程师');
    expect(result.zh).toContain('地铁站');
    expect(result.en).toContain('aerospace engineer');
    expect(result.en).toContain('subway station');
  });

  it('基础设定板给出可执行的多视图、表情和细节布局，并尊重文字开关', () => {
    const values = { ...createInitialValues(), showLabels: 'false', detailCount: '5', expressions: '微笑，惊讶' };
    const out = buildOutputs(values, 'basic', '通用');
    expect(out.zh).toContain('正面');
    expect(out.zh).toContain('侧面');
    expect(out.zh).toContain('背面');
    expect(out.zh).toContain('微笑');
    expect(out.zh).toContain('5');
    expect(out.zh).toContain('不添加文字');
  });

  it('英文界面内置选项均有可读的英文名称', () => {
    const missing = GROUPS.flatMap(group => group.fields.flatMap(field => field.options ?? []))
      .filter(option => /[\u3400-\u9fff]/u.test(translateValue(option)));
    expect([...new Set(missing)]).toEqual([]);
    expect(buildOutputs(createInitialValues(), 'basic', '通用').en).not.toMatch(/[\u3400-\u9fff]/u);
    for (const preset of BUILT_IN_PRESETS) {
      expect(buildOutputs(preset.values, preset.template, preset.model).en).not.toMatch(/[\u3400-\u9fff]/u);
    }
  });

  it('默认负面词有内容，关闭后不输出', () => {
    const defaults = createInitialValues();
    expect(buildOutputs(defaults, 'basic', '通用').negative).toContain('模糊');
    expect(buildOutputs({ ...defaults, enableNegative: 'false' }, 'basic', '通用').negative).toBe('');
  });

  it('尺寸与比例冲突时给出提示并不输出冲突尺寸', () => {
    const values = { ...createInitialValues(), aspectRatio: '16:9', size: '1024x1024' };
    const out = buildOutputs(values, 'basic', 'SDXL');
    expect(out.parameters).toContain('不一致');
    expect(out.parameters).not.toContain('Size: 1024x1024');
    const matching = buildOutputs({ ...values, size: '1344x768' }, 'basic', 'SDXL');
    expect(matching.parameters).toContain('Size: 1344x768');
  });
});
