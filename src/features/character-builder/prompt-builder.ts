import { EXTRA_OPTION_TRANSLATIONS, GROUPS, TEMPLATES, UNSPECIFIED, type CharacterField, type CharacterValues, type TemplateId } from './character-data';

export type PromptOutputs = Readonly<{ zh: string; en: string; bilingual: string; negative: string; json: string; parameters: string; characterId: string }>;

const TRANSLATIONS: Readonly<Record<string, string>> = {
  '不指定': 'Not specified', '自然双眼皮': 'natural double eyelids', '运动背心': 'sports tank top', '左侧三视图': 'three-view turnaround on the left', '右侧头像': 'headshot on the right',
  '自定义': 'Custom', '欧式古典': 'Classical European', '少年感': 'Youthful', '青年': 'Young adult', '轻熟': 'Young and mature',
  '纤长': 'Long and fine', '短睫毛': 'Short eyelashes', '自然唇形': 'Natural lip shape', '眼角痣': 'Beauty mark near eye', '唇下痣': 'Beauty mark below lip', '鼻尖痣': 'Beauty mark on nose', '眉骨细疤': 'Small brow scar', '耳垂痣': 'Beauty mark on earlobe', '短碎发': 'Short textured hair', '波浪发': 'Wavy hair',
  '正装': 'Formal wear', '职业装': 'Professional wear', '运动装': 'Sportswear', '幻想服装': 'Fantasy costume', '礼服': 'Evening wear', '肩颈': 'Shoulders and neck', '锁骨': 'Collarbone', '手臂': 'Arms', '手部': 'Hands', '背部': 'Back', '腿部': 'Legs', '脚踝': 'Ankles', '服装展示': 'Outfit display',
  '眼睛': 'Eyes', '面部': 'Face', '服装细节': 'Clothing details', '场景': 'Scene', '固定镜头': 'Static camera', '缓慢推进': 'Slow push-in', '平移': 'Pan', '跟拍': 'Tracking shot', '环绕': 'Orbit', '手持': 'Handheld', '高细节': 'High detail', '正面头像': 'Front headshot', '侧面头像': 'Profile headshot', '鞋子': 'Shoes', '服饰纹理': 'Fabric texture', '饰品': 'Accessories', '特殊标记': 'Distinctive marks',
  '中文': 'Chinese', '英文': 'English', '中英双语': 'Chinese and English', '通用': 'General', '新角色': 'New character',
  '林岚': 'Lin Lan', '夏知': 'Xia Zhi', '云衡': 'Yun Heng', '路遥': 'Lu Yao', '许宁': 'Xu Ning', '建筑师': 'architect', '大学生': 'university student', '探索员': 'explorer', '调查员': 'investigator', '简约通勤': 'minimalist workwear', '轻松日常': 'relaxed everyday style', '古风长袍': 'traditional long robe', '功能性外套': 'functional jacket', '深色大衣': 'dark overcoat',
  '女性': 'female', '男性': 'male', '中性': 'gender-neutral', '中国': 'China', '日本': 'Japan', '韩国': 'South Korea', '美国': 'United States', '英国': 'United Kingdom', '法国': 'France', '意大利': 'Italy',
  '现代都市': 'modern city', '东方古代': 'ancient East Asian setting', '未来都市': 'futuristic city', '架空世界': 'fictional world',
  '都市': 'urban drama', '古装': 'period drama', '悬疑': 'mystery', '奇幻': 'fantasy', '科幻': 'science fiction', '喜剧': 'comedy', '校园': 'school setting', '年代': 'historical period',
  '主角': 'protagonist', '配角': 'supporting character', '对手': 'rival', '导师': 'mentor', '群像人物': 'ensemble character',
  '自然写实': 'natural realism', '电影感': 'cinematic', '清新': 'fresh', '成熟': 'mature', '古典': 'classical', '个性': 'distinctive', '自然': 'natural', '突出': 'striking', '惊艳': 'stunning',
  '温柔': 'gentle', '冷静': 'calm', '自信': 'confident', '勇敢': 'brave', '克制': 'reserved', '活泼': 'lively', '敏锐': 'perceptive', '坚韧': 'resilient', '神秘': 'mysterious', '幽默': 'witty', '理性': 'rational', '浪漫': 'romantic',
  '鹅蛋脸': 'oval face', '圆脸': 'round face', '方脸': 'square face', '长脸': 'long face', '心形脸': 'heart-shaped face', '菱形脸': 'diamond-shaped face', '杏眼': 'almond eyes', '圆眼': 'round eyes',
  '短发': 'short hair', '齐肩发': 'shoulder-length hair', '中长发': 'medium-long hair', '长发': 'long hair', '超长发': 'very long hair', '光头': 'shaved head',
  '黑色': 'black', '深棕': 'dark brown', '浅棕': 'light brown', '金色': 'blond', '银色': 'silver', '红色': 'red', '蓝色': 'blue', '直发': 'straight hair', '卷发': 'curly hair', '马尾': 'ponytail', '盘发': 'updo', '编发': 'braids',
  '平静': 'calm', '微笑': 'smiling', '开心': 'happy', '悲伤': 'sad', '惊讶': 'surprised', '愤怒': 'angry', '紧张': 'nervous', '思考': 'thoughtful',
  '纯色背景': 'solid-color background', '清晰分区': 'clearly separated sections', '不加文字': 'no text', '简洁标签': 'simple labels', '详细标签': 'detailed labels',
  '一般': 'standard', '较强': 'strong', '极强': 'very strong', '标准': 'standard', '轻微': 'subtle', '严格': 'strict', '自然语言': 'natural language', '分组列表': 'structured list', '关键词': 'keywords',
  '模糊': 'blur', '低清晰度': 'low resolution', 'AI感过强': 'artificial appearance', '五官错误': 'incorrect facial features', '肢体错误': 'incorrect anatomy', '手部错误': 'malformed hands', '角色不一致': 'inconsistent character', '乱码文字': 'garbled text', '水印': 'watermark',
  '东亚': 'East Asian', '东南亚': 'Southeast Asian', '南亚': 'South Asian', '欧洲': 'European', '非洲': 'African', '拉丁美洲': 'Latin American', '中东': 'Middle Eastern', '混合背景': 'mixed heritage',
  '学生': 'student', '医生': 'doctor', '教师': 'teacher', '记者': 'journalist', '设计师': 'designer', '律师': 'lawyer', '警察': 'police officer', '研究员': 'researcher', '创业者': 'entrepreneur', '演员': 'actor', '厨师': 'chef', '探险家': 'explorer', '王族': 'royalty', '骑士': 'knight', '侦探': 'detective', '旅行者': 'traveler',
  '柔和': 'soft', '立体': 'dimensional', '清晰': 'defined', '圆润': 'rounded', '精致': 'refined', '棱角分明': 'angular', '窄下颌': 'narrow jaw', '方正': 'square', '明显': 'pronounced', '平缓': 'subtle', '适中': 'moderate', '略高': 'slightly high',
  '丹凤眼': 'upturned eyes', '细长眼': 'narrow eyes', '下垂眼': 'downturned eyes', '坚定': 'determined', '温和': 'gentle', '专注': 'focused', '清澈': 'clear', '疏离': 'distant', '好奇': 'curious', '忧郁': 'melancholic', '明亮': 'bright', '略宽': 'slightly wide', '略窄': 'slightly narrow',
  '自然眉': 'natural brows', '平眉': 'straight brows', '弯眉': 'arched brows', '剑眉': 'angular brows', '浓眉': 'thick brows', '细眉': 'thin brows', '直鼻': 'straight nose', '小巧鼻': 'small nose', '圆鼻尖': 'rounded nose tip', '挺鼻梁': 'high nose bridge', '宽鼻翼': 'wide nostrils', '微翘鼻': 'upturned nose', '饱满': 'full', '偏薄': 'thin', '唇峰明显': 'defined cupid’s bow', '浅粉': 'light pink', '豆沙色': 'rose brown', '珊瑚色': 'coral', '深红': 'deep red', '裸色': 'nude',
  '柔顺': 'smooth', '蓬松': 'voluminous', '细软': 'fine and soft', '浓密': 'thick', '自然毛躁': 'naturally tousled', '湿润': 'damp', '无刘海': 'no fringe', '齐刘海': 'straight fringe', '侧分刘海': 'side-swept fringe', '空气刘海': 'wispy fringe', '碎刘海': 'textured fringe', '八字刘海': 'curtain bangs', '自然直落': 'naturally straight', '微卷': 'gently curled', '内扣': 'curled inward', '外翘': 'flipped outward', '层次剪裁': 'layered cut', '整洁': 'neat', '随风飘动': 'windblown', '微乱': 'slightly tousled', '湿发': 'wet hair',
  '纤细': 'slender', '匀称': 'balanced', '健壮': 'athletic', '丰满': 'full-figured', '高挑': 'tall and slender', '娇小': 'petite', '修长': 'elongated', '均衡': 'balanced', '肩宽': 'broad shoulders', '腿长': 'long legs', '紧凑': 'compact', '宽肩': 'broad shoulders', '窄肩': 'narrow shoulders', '平肩': 'level shoulders', '柔和肩线': 'soft shoulder line', '颈部修长': 'long neck', '平直': 'straight', '柔和曲线': 'soft curves', '直线型': 'straight silhouette', '挺拔': 'upright', '放松': 'relaxed', '优雅': 'elegant', '利落': 'poised', '自然站姿': 'natural standing pose', '略微前倾': 'leaning slightly forward', '轻微运动感': 'lightly athletic', '结实': 'toned', '肌肉明显': 'muscular',
  '白皙': 'fair', '浅肤色': 'light skin', '自然肤色': 'natural skin tone', '小麦色': 'wheat skin tone', '古铜色': 'bronze skin tone', '深肤色': 'deep skin tone', '暖调': 'warm undertone', '冷调': 'cool undertone', '橄榄调': 'olive undertone', '自然纹理': 'natural texture', '细腻': 'fine texture', '真实毛孔': 'visible pores', '粗粝': 'rough texture', '雀斑': 'freckles', '痣': 'beauty mark', '轻微晒斑': 'light sun spots', '疤痕': 'scar', '皱纹': 'wrinkles', '哑光': 'matte', '轻微光泽': 'subtle sheen', '晒后': 'sun-kissed', '丰富': 'rich',
  '素颜': 'no makeup', '自然淡妆': 'natural light makeup', '日常': 'everyday', '复古': 'vintage', '舞台': 'stage', '古风': 'traditional Chinese style', '轻透': 'sheer', '光泽': 'dewy', '大地色': 'earth tones', '淡眼线': 'subtle eyeliner', '烟熏': 'smoky', '正红': 'true red', '唇釉': 'lip gloss', '无': 'none', '淡粉': 'pale pink', '珊瑚': 'coral', '眼镜': 'glasses', '帽子': 'hat', '围巾': 'scarf', '发夹': 'hair clip', '手表': 'watch', '包': 'bag', '手套': 'gloves', '耳钉': 'stud earrings', '耳环': 'earrings', '项链': 'necklace', '戒指': 'ring', '手链': 'bracelet', '胸针': 'brooch',
  '白衬衫': 'white shirt', 'T恤': 'T-shirt', '针织衫': 'knitwear', '卫衣': 'hoodie', '西装外套': 'blazer', '风衣': 'trench coat', '衬衫': 'shirt', '夹克': 'jacket', '汉服上衣': 'hanfu top', '盔甲': 'armor', '牛仔裤': 'jeans', '西裤': 'tailored trousers', '长裙': 'long skirt', '半身裙': 'skirt', '短裤': 'shorts', '运动裤': 'sweatpants', '长裤': 'trousers', '古风裙': 'traditional skirt', '工装裤': 'cargo pants', '运动鞋': 'sneakers', '皮鞋': 'dress shoes', '靴子': 'boots', '高跟鞋': 'high heels', '帆布鞋': 'canvas shoes', '凉鞋': 'sandals', '布鞋': 'cloth shoes',
  '简约': 'minimalist', '休闲': 'casual', '商务': 'business', '运动': 'sporty', '未来感': 'futuristic', '街头': 'streetwear', '学院': 'preppy', '白色': 'white', '灰色': 'gray', '米色': 'beige', '棕色': 'brown', '绿色': 'green', '粉色': 'pink', '棉': 'cotton', '亚麻': 'linen', '羊毛': 'wool', '丝绸': 'silk', '牛仔': 'denim', '皮革': 'leather', '针织': 'knit', '轻纱': 'sheer fabric', '金属': 'metal', '科技面料': 'technical fabric', '宽松': 'loose', '合身': 'well-fitted', '修身': 'slim fit', '自然垂坠': 'natural drape', '层次叠穿': 'layered',
  '站立': 'standing', '行走': 'walking', '坐下': 'sitting', '转身': 'turning', '奔跑': 'running', '举手': 'raising a hand', '整理衣领': 'adjusting a collar', '阅读': 'reading', '回眸': 'looking back', '双臂自然下垂': 'arms relaxed at sides', '双手交叠': 'hands folded', '叉腰': 'hands on hips', '坐姿': 'seated', '侧身': 'turned sideways', '动态姿态': 'dynamic pose', '看向镜头': 'looking at camera', '望向远方': 'looking into distance', '侧看': 'looking sideways', '低头': 'looking down', '抬头': 'looking up', '闭眼': 'eyes closed', '喜悦': 'joy', '忧伤': 'sadness', '强烈': 'intense',
  '三视图': 'three-view turnaround', '全身像': 'full-body portrait', '半身像': 'half-body portrait', '头像': 'headshot', '表情': 'expressions', '细节图': 'detail panels', '服装': 'wardrobe', '色卡': 'color palette', '网格布局': 'grid layout', '横向排列': 'horizontal layout', '纵向排列': 'vertical layout', '画报式构图': 'editorial composition', '浅灰背景': 'light gray background', '深灰背景': 'dark gray background', '纯白背景': 'white background', '自然场景': 'natural scene', '透明背景': 'transparent background',
  '特写': 'close-up', '近景': 'close shot', '中景': 'medium shot', '半身': 'half-body shot', '全身': 'full-body shot', '远景': 'long shot', '大全景': 'extreme long shot', '平视': 'eye level', '俯视': 'high angle', '仰视': 'low angle', '正面': 'front view', '侧面': 'side view', '背面': 'rear view', '四分之三侧面': 'three-quarter view', '自然摄影': 'natural photography', '电影摄影': 'cinematic photography', '纪实摄影': 'documentary photography', '时尚摄影': 'fashion photography', '棚拍': 'studio photography', '胶片感': 'film look', '自然光': 'natural light', '柔光': 'soft light', '侧光': 'side light', '逆光': 'backlight', '轮廓光': 'rim light', '棚拍光': 'studio lighting', '霓虹灯': 'neon light', '烛光': 'candlelight', '浅景深': 'shallow depth of field', '中景深': 'moderate depth of field', '深景深': 'deep depth of field', '背景虚化': 'blurred background',
  '摄影棚': 'studio', '街道': 'street', '咖啡馆': 'cafe', '办公室': 'office', '图书馆': 'library', '海边': 'seaside', '森林': 'forest', '庭院': 'courtyard', '宫殿': 'palace', '未来城市': 'futuristic city', '清晨': 'early morning', '上午': 'morning', '正午': 'noon', '午后': 'afternoon', '黄昏': 'dusk', '夜晚': 'night', '深夜': 'late night', '晴天': 'sunny', '多云': 'cloudy', '阴天': 'overcast', '雨天': 'rainy', '雪天': 'snowy', '薄雾': 'misty', '大风': 'windy', '温暖': 'warm', '宁静': 'peaceful', '欢快': 'cheerful', '孤独': 'lonely', '庄重': 'solemn', '暖色调': 'warm palette', '冷色调': 'cool palette', '中性色': 'neutral palette', '低饱和': 'muted palette', '高对比': 'high contrast', '柔和粉彩': 'soft pastels', '黑白': 'black and white', '简洁': 'minimal',
};

function specifiedValue(raw: string | undefined, multiple = false): string {
  const value = raw?.trim() ?? '';
  if (!value || value === UNSPECIFIED) return '';
  if (!multiple) return value;
  const parts = value.split(/[,，、]/u).map(part => part.trim());
  return parts.includes(UNSPECIFIED) ? parts.filter(part => part && part !== UNSPECIFIED).join('，') : value;
}

function templateDirection(values: CharacterValues, template: TemplateId, english: boolean): string {
  const expressions = specifiedValue(values.expressions, true) || '平静，微笑，惊讶';
  const specifiedDetails = specifiedValue(values.detailTypes, true);
  const details = specifiedDetails || '头部轮廓、手部与服装细节';
  const count = values.detailCount?.trim() || '4';
  const frameCount = values.shotCount?.trim() || '4';
  const left = specifiedValue(values.leftContent);
  const right = specifiedValue(values.rightContent);
  const labelRule = isEnabled(values, 'showLabels')
    ? (english ? 'Add concise, legible labels only where needed.' : '按需添加简洁清晰的文字标注。')
    : (english ? 'Do not add text, watermarks, or decorative lettering.' : '不添加文字、乱码、水印或装饰性字样。');
  const selectedDetails = english ? (specifiedDetails ? translateValue(details) : 'head shape, hands and clothing details') : details;
  const detailRule = isEnabled(values, 'includeDetails')
    ? (english ? `Include ${count} detail panels for ${selectedDetails}; use matching visual references.` : `安排 ${count} 个细节区，展示${selectedDetails}；与主角色保持对应。`)
    : (english ? 'Do not add separate detail panels.' : '不额外添加细节图。');
  const arrangements = template === 'basic' && (left || right) ? (english
    ? `Respect the requested arrangement: left ${translateValue(left || 'unspecified')}; right ${translateValue(right || 'unspecified')}.`
    : `尊重指定布局：左侧${left || '按需安排'}，右侧${right || '按需安排'}。`) : '';
  const directions: Record<TemplateId, readonly [string, string]> = {
    basic: [
      `制作角色设定板。${left && left !== '三视图' ? `主体区域展示${left}` : '主体区域展示同一角色正面、侧面和背面全身参考，视角清晰，头脚完整'}；${right ? `辅助区域展示${right}` : '辅助区域展示头部不同角度'}，并展示表情（${expressions}）。${detailRule} ${arrangements}`,
      `Create a character design sheet. ${left && left !== '三视图' ? `Show ${translateValue(left)} in the main area` : 'Use complete front, side and back full-body references in the main area'}; ${right ? `show ${translateValue(right)} in the supporting area` : 'show the head from different angles in supporting panels'}, including expressions (${translateValue(expressions)}). ${detailRule} ${arrangements}`,
    ],
    'three-view': [
      `展示同一角色的正面、侧面和背面全身三视图。人物站姿自然、头脚完整，三个视角使用一致的高度、比例、服装和光照，避免遮挡。${arrangements}`,
      `Show the same character in complete front, side and back full-body views. Use a natural pose, consistent scale, clothing and lighting; keep head and feet visible. ${arrangements}`,
    ],
    expressions: [
      `制作表情设定板，以相同取景和光线逐格展示：${expressions}。每格只改变表情与情绪，保持人物外貌、发型及特征一致。${arrangements}`,
      `Create an expression sheet showing ${translateValue(expressions)} in separate panels with consistent framing and lighting. Change only emotion and expression; preserve identity and identifying traits. ${arrangements}`,
    ],
    wardrobe: [
      `制作服装设定板：展示当前服装及适合角色的不同搭配，每套造型以完整身形清楚呈现。保留服装的颜色、材质和结构设定，人物外貌与体态保持一致。${detailRule} ${arrangements}`,
      `Create a wardrobe sheet showing the specified outfit and suitable variations on a complete figure. Preserve the chosen materials, colors and garment structure, and keep identity and body proportions consistent. ${detailRule} ${arrangements}`,
    ],
    still: [
      `制作单张短剧剧照：突出角色当下的动作和情绪，让场景、光线与镜头共同表达一个可读的叙事瞬间。画面内避免出现与场景无关的人物或杂乱元素。`,
      'Create a single dramatic still with a clear character action and emotion. Let the setting, lighting and camera convey a readable narrative moment without distracting unrelated elements.',
    ],
    storyboard: [
      `制作 ${frameCount} 张连续分镜，按时间顺序呈现起始、动作发展和结果；每格构图清晰，动作自然衔接，场景方位、人物外貌和服装保持连续。${arrangements}`,
      `Create ${frameCount} sequential storyboard frames showing a beginning, action development and outcome. Keep transitions coherent and preserve character appearance, wardrobe and spatial continuity. ${arrangements}`,
    ],
  };
  return `${directions[template][english ? 1 : 0]}\n${labelRule}`;
}

export function translateValue(value: string): string {
  return value.split(/\s*[,，、]\s*/).map(part => EXTRA_OPTION_TRANSLATIONS[part] ?? TRANSLATIONS[part] ?? part.replace(/^(\d+)岁$/u, '$1 years old')).join(', ');
}

function isEnabled(values: CharacterValues, key: string): boolean {
  return values[key] === 'true';
}

function formattedField(field: CharacterField, values: CharacterValues, english: boolean): string | undefined {
  const value = specifiedValue(values[field.id], field.type === 'tags');
  if (!value) return undefined;
  if (field.type === 'toggle') return value === 'true' ? (english ? field.enLabel : field.label) : undefined;
  return `${english ? field.enLabel : field.label}：${english ? translateValue(value) : value}`;
}

function groupText(values: CharacterValues, english: boolean, template: TemplateId): string[] {
  const excluded = new Set(['format', 'negative', 'advanced']);
  return GROUPS.filter(group => !excluded.has(group.id)).flatMap(group => {
    if (group.id === 'detail' && (!isEnabled(values, 'includeDetails') || !['basic', 'wardrobe'].includes(template))) return [];
    const fields = group.fields.filter(field => {
      // A template selects its own composition; the base sheet's left/right
      // arrangement must not leak into stills, expressions or storyboards.
      if (group.id === 'layout' && template !== 'basic') {
        if (['leftContent', 'rightContent', 'composition'].includes(field.id)) return false;
        if (['still', 'storyboard'].includes(template) && ['layout', 'showGuides', 'showPalette'].includes(field.id)) return false;
        if (field.id === 'detailCount' && template !== 'wardrobe') return false;
      }
      if (group.id === 'expression') {
        if (template === 'expressions' && field.id !== 'expressions') return false;
        if (!['basic', 'expressions'].includes(template) && field.id === 'expressions') return false;
      }
      if (template === 'expressions' && group.id === 'camera' && field.id === 'shotSize') return false;
      if (field.id === 'shotCount' && template !== 'storyboard') return false;
      if (field.id === 'detailCount' && !isEnabled(values, 'includeDetails')) return false;
      if (field.id === 'annotation' && !isEnabled(values, 'showLabels')) return false;
      if (field.id === 'annotation' && values.annotation === '不加文字' && isEnabled(values, 'showLabels')) return false;
      return true;
    }).map(field => formattedField(field, values, english)).filter(Boolean);
    return fields.length ? [`## ${english ? group.enLabel : group.label}\n${fields.map(field => `- ${field}`).join('\n')}`] : [];
  });
}

function negativePrompt(values: CharacterValues): string {
  if (!isEnabled(values, 'enableNegative')) return '';
  const details = [specifiedValue(values.negativeCategories, true), specifiedValue(values.negativeDetails),
    isEnabled(values, 'includeAdditional') ? specifiedValue(values.additionalNegative) : ''].filter(Boolean);
  return details.join('，');
}

function modelParameters(values: CharacterValues, model: string, english = false): string {
  const size = specifiedValue(values.size);
  const dimensions = /^(\d{1,5})\s*[x×]\s*(\d{1,5})$/iu.exec(size);
  const ratio = /^(\d{1,3})\s*:\s*(\d{1,3})$/u.exec(specifiedValue(values.aspectRatio));
  const validSize = !size || Boolean(dimensions && Number(dimensions[1]) > 0 && Number(dimensions[2]) > 0);
  const matchesRatio = !dimensions || !ratio || !Number(ratio[2]) || Math.abs((Number(dimensions[1]) / Number(dimensions[2])) / (Number(ratio[1]) / Number(ratio[2])) - 1) <= 0.04;
  const sizeWarning = !validSize ? (english ? 'Size is invalid; enter width x height.' : '尺寸格式无效，请填写宽×高。')
    : !matchesRatio ? (english ? 'Size and aspect ratio conflict; size omitted until corrected.' : '尺寸与画面比例不一致，已暂不输出尺寸，请调整后再复制。') : '';
  const entries = (fields: readonly [string, string][]) => [sizeWarning, ...fields.filter(([, key]) => specifiedValue(values[key]) && (key !== 'size' || (validSize && matchesRatio))).map(([label, key]) => `${label}: ${specifiedValue(values[key])}`)].filter(Boolean).join('\n');
  if (model === 'Midjourney') return [specifiedValue(values.aspectRatio) && `--ar ${specifiedValue(values.aspectRatio)}`, specifiedValue(values.seed) && values.seed !== '-1' && `--seed ${specifiedValue(values.seed)}`].filter(Boolean).join(' ');
  if (model === 'Stable Diffusion' || model === 'SDXL') return entries([['Size', 'size'], ['Steps', 'steps'], ['CFG', 'cfg'], ['Sampler', 'sampler'], ['Seed', 'seed']]);
  if (model === 'Flux') return entries([['Size', 'size'], ['Steps', 'steps'], ['Seed', 'seed']]);
  return entries([['Aspect ratio', 'aspectRatio'], ['Seed', 'seed']]);
}

function advancedText(values: CharacterValues, english: boolean): string {
  const fields = GROUPS.find(group => group.id === 'advanced')?.fields ?? [];
  const excluded = new Set(['size', 'steps', 'cfg', 'sampler', 'seed', 'additionalNegative', 'includeAdditional']);
  const items = fields.filter(field => !excluded.has(field.id) && (field.id !== 'additionalPositive' || isEnabled(values, 'includeAdditional')))
    .map(field => formattedField(field, values, english)).filter(Boolean);
  return items.length ? `## ${english ? 'Additional instructions' : '补充要求'}\n${items.map(item => `- ${item}`).join('\n')}` : '';
}

function buildText(values: CharacterValues, template: TemplateId, model: string, english: boolean, negative: string, parameters: string): string {
  const chosen = TEMPLATES.find(item => item.id === template) ?? TEMPLATES[0];
  const direction = templateDirection(values, chosen.id, english);
  const shotCount = template === 'storyboard' && values.shotCount?.trim() ? (english ? `Create ${values.shotCount} sequential shots.` : `连续分镜数量：${values.shotCount} 张。`) : '';
  const raw = [`# ${english ? chosen.enLabel : chosen.label}`, direction, shotCount, ...groupText(values, english, chosen.id), advancedText(values, english)].filter(Boolean);
  if (negative && isEnabled(values, 'includeNegative')) {
    const strength = specifiedValue(values.negativeStrength);
    raw.push(`## ${english ? 'Negative prompt' : '负面词'}\n${strength ? `${english ? 'Avoidance intensity' : '规避程度'}：${english ? translateValue(strength) : strength}\n` : ''}${english ? translateValue(negative) : negative}`);
  }
  if (parameters && isEnabled(values, 'includeParameters')) raw.push(`## ${english ? 'Parameters' : '模型参数'} (${english ? translateValue(model) : model})\n${parameters}`);
  if (english && /[\u3400-\u9fff]/u.test(raw.join(' '))) raw.push('Note: some values are kept in their original language.');
  if (values.promptFormat === '关键词') return raw.join(', ').replaceAll('\n', ', ');
  if (values.promptFormat === '自然语言') return raw.join('\n\n').replace(/^##? /gm, '').replace(/^- /gm, '');
  return raw.join('\n\n');
}

export function buildOutputs(values: CharacterValues, template: TemplateId | string, model: string): PromptOutputs {
  const chosen = TEMPLATES.find(item => item.id === template) ?? TEMPLATES[0];
  const negative = negativePrompt(values);
  const parameters = modelParameters(values, model);
  const englishParameters = modelParameters(values, model, true);
  const characterId = isEnabled(values, 'includeCharacterId')
    ? ['name', 'age', 'gender', 'faceShape', 'hairStyle', 'marks'].map(key => specifiedValue(values[key], key === 'marks')).filter(Boolean).join(' / ')
    : '';
  const zh = buildText(values, chosen.id, model, false, negative, parameters);
  const en = buildText(values, chosen.id, model, true, negative, englishParameters);
  return {
    zh,
    en,
    bilingual: `${zh}\n\n${en}`,
    negative,
    json: JSON.stringify({ version: 1, template: chosen.id, model, values }, null, 2),
    parameters,
    characterId,
  };
}
