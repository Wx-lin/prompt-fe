export type FieldType = 'text' | 'textarea' | 'select' | 'tags' | 'number' | 'toggle';
export type CharacterField = Readonly<{ id: string; label: string; enLabel: string; type: FieldType; defaultValue: string; options?: readonly string[] }>;
export type CharacterGroup = Readonly<{ id: string; label: string; enLabel: string; fields: readonly CharacterField[] }>;
export type CharacterValues = Record<string, string>;

const text = (id: string, label: string, enLabel: string, defaultValue = ''): CharacterField => ({ id, label, enLabel, type: 'text', defaultValue });
const area = (id: string, label: string, enLabel: string, defaultValue = ''): CharacterField => ({ id, label, enLabel, type: 'textarea', defaultValue });
const select = (id: string, label: string, enLabel: string, options: readonly string[], defaultValue = ''): CharacterField => ({ id, label, enLabel, type: 'select', options, defaultValue });
const tags = (id: string, label: string, enLabel: string, options: readonly string[], defaultValue = ''): CharacterField => ({ id, label, enLabel, type: 'tags', options, defaultValue });
const number = (id: string, label: string, enLabel: string, defaultValue = ''): CharacterField => ({ id, label, enLabel, type: 'number', defaultValue });
const toggle = (id: string, label: string, enLabel: string, on = false): CharacterField => ({ id, label, enLabel, type: 'toggle', defaultValue: String(on) });

export const TEMPLATES = [
  { id: 'basic', label: '基础角色设定板', enLabel: 'Character design sheet' },
  { id: 'three-view', label: '三视图设定板', enLabel: 'Character turnaround' },
  { id: 'expressions', label: '表情设定板', enLabel: 'Expression sheet' },
  { id: 'wardrobe', label: '服装设定板', enLabel: 'Wardrobe sheet' },
  { id: 'still', label: '短剧剧照', enLabel: 'Dramatic still' },
  { id: 'storyboard', label: '连续分镜剧照', enLabel: 'Sequential storyboard' },
] as const;
export type TemplateId = typeof TEMPLATES[number]['id'];
export const MODELS = ['通用', 'Midjourney', 'Stable Diffusion', 'SDXL', 'Flux', '即梦', '可灵', '豆包', 'Runway', 'Pika', 'Luma', 'Sora'] as const;

const BASE_GROUPS: readonly CharacterGroup[] = [
  { id: 'basic', label: '基础信息', enLabel: 'Basic information', fields: [
    text('name', '角色姓名', 'Character name', '新角色'), text('age', '年龄', 'Age', '25岁'),
    select('gender', '性别', 'Gender', ['女性', '男性', '中性', '自定义'], '女性'),
    select('country', '国家／地区', 'Country or region', ['中国', '日本', '韩国', '美国', '英国', '法国', '意大利', '架空世界'], '中国'),
    select('regionalStyle', '地域风格', 'Regional setting', ['现代都市', '东方古代', '欧式古典', '未来都市', '架空世界'], '现代都市'),
    select('ethnicity', '外貌族群风格', 'Appearance and heritage', ['东亚', '东南亚', '南亚', '欧洲', '非洲', '拉丁美洲', '中东', '混合背景']), select('occupation', '职业／身份', 'Occupation or role', ['学生', '医生', '教师', '记者', '设计师', '律师', '警察', '研究员', '创业者', '演员', '厨师', '探险家', '王族', '骑士', '侦探', '旅行者']), area('description', '补充描述', 'Additional description'), area('aiDetails', 'AI 补充细节', 'AI additional details'),
  ] },
  { id: 'role', label: '角色定位', enLabel: 'Character direction', fields: [
    select('genre', '剧种', 'Genre', ['都市', '古装', '悬疑', '奇幻', '科幻', '喜剧', '校园', '年代'], '都市'),
    select('rolePosition', '角色位置', 'Narrative role', ['主角', '配角', '对手', '导师', '群像人物'], '主角'),
    tags('personality', '性格标签', 'Personality', ['温柔', '冷静', '自信', '勇敢', '克制', '活泼', '敏锐', '坚韧', '神秘', '幽默', '理性', '浪漫']),
    select('beautyDirection', '外貌方向', 'Appearance direction', ['自然写实', '电影感', '清新', '成熟', '古典', '个性'], '自然写实'),
    select('beautyLevel', '外貌程度', 'Appearance intensity', ['自然', '突出', '惊艳']), text('temperament', '气质', 'Temperament'),
    select('maturity', '成熟度', 'Maturity', ['少年感', '青年', '轻熟', '成熟']), text('presence', '气场', 'Presence'),
  ] },
  { id: 'face', label: '脸部五官', enLabel: 'Facial features', fields: [
    select('faceShape', '脸型', 'Face shape', ['鹅蛋脸', '圆脸', '方脸', '长脸', '心形脸', '菱形脸']),
    select('boneStructure', '骨相', 'Bone structure', ['柔和', '立体', '清晰', '圆润', '精致', '棱角分明']), select('jawline', '下颌线', 'Jawline', ['柔和', '清晰', '圆润', '窄下颌', '方正']), select('cheekbones', '颧骨', 'Cheekbones', ['柔和', '明显', '平缓', '适中', '略高']),
    select('eyeShape', '眼型', 'Eye shape', ['杏眼', '圆眼', '丹凤眼', '细长眼', '下垂眼']), text('eyelids', '眼睑', 'Eyelids'),
    select('eyeExpression', '眼神', 'Gaze', ['坚定', '温和', '专注', '清澈', '疏离', '好奇', '忧郁', '明亮']), select('eyeSpacing', '眼距', 'Eye spacing', ['适中', '略宽', '略窄']), select('eyelashes', '睫毛', 'Eyelashes', ['自然', '纤长', '浓密', '短睫毛']),
    select('eyebrows', '眉毛', 'Eyebrows', ['自然眉', '平眉', '弯眉', '剑眉', '浓眉', '细眉']), select('nose', '鼻型', 'Nose', ['直鼻', '小巧鼻', '圆鼻尖', '挺鼻梁', '宽鼻翼', '微翘鼻']), select('lips', '唇形', 'Lips', ['自然唇形', '饱满', '偏薄', '唇峰明显', '圆润']), select('lipColor', '唇色', 'Lip color', ['自然', '浅粉', '豆沙色', '珊瑚色', '深红', '裸色']),
    tags('marks', '特色标记', 'Distinctive marks', ['无', '眼角痣', '唇下痣', '鼻尖痣', '雀斑', '眉骨细疤', '耳垂痣']), text('baseExpression', '基础表情', 'Neutral expression'),
  ] },
  { id: 'hair', label: '发型', enLabel: 'Hair', fields: [
    select('hairLength', '头发长度', 'Hair length', ['短发', '齐肩发', '中长发', '长发', '超长发', '光头']),
    select('hairColor', '发色', 'Hair color', ['黑色', '深棕', '浅棕', '金色', '银色', '红色', '蓝色']),
    select('hairStyle', '发型', 'Hairstyle', ['直发', '卷发', '马尾', '盘发', '编发', '短碎发', '波浪发']),
    select('hairTexture', '发质', 'Hair texture', ['柔顺', '蓬松', '细软', '浓密', '自然毛躁', '湿润']), select('fringe', '刘海', 'Fringe', ['无刘海', '齐刘海', '侧分刘海', '空气刘海', '碎刘海', '八字刘海']), select('hairEnds', '发尾', 'Hair ends', ['自然直落', '微卷', '内扣', '外翘', '层次剪裁']), select('hairCondition', '头发状态', 'Hair condition', ['整洁', '随风飘动', '微乱', '湿发', '蓬松']),
  ] },
  { id: 'body', label: '身材体态', enLabel: 'Body and posture', fields: [
    text('height', '身高', 'Height'), select('bodyType', '体型', 'Body type', ['纤细', '匀称', '健壮', '丰满', '高挑', '娇小']),
    select('proportions', '身材比例', 'Body proportions', ['自然', '修长', '均衡', '肩宽', '腿长', '紧凑']), select('shoulders', '肩颈', 'Shoulders and neck', ['自然', '宽肩', '窄肩', '平肩', '柔和肩线', '颈部修长']), select('waist', '腰线', 'Waistline', ['自然', '纤细', '平直', '明显']),
    select('waistHip', '腰臀关系', 'Waist-to-hip proportions', ['自然', '匀称', '柔和曲线', '直线型']), select('legs', '腿型', 'Leg shape', ['匀称', '修长', '健壮', '自然']), select('posture', '体态', 'Posture', ['挺拔', '放松', '优雅', '利落', '自然站姿', '略微前倾']), select('musculature', '肌肉感', 'Musculature', ['自然', '轻微运动感', '结实', '肌肉明显']),
  ] },
  { id: 'skin', label: '肤色皮肤', enLabel: 'Skin', fields: [
    select('skinTone', '肤色', 'Skin tone', ['白皙', '浅肤色', '自然肤色', '小麦色', '古铜色', '深肤色']), select('undertone', '肤色冷暖', 'Undertone', ['中性', '暖调', '冷调', '橄榄调']), select('skinTexture', '皮肤质感', 'Skin texture', ['自然纹理', '细腻', '真实毛孔', '柔和', '粗粝']), tags('skinDetails', '皮肤细节', 'Skin details', ['雀斑', '痣', '自然纹理', '轻微晒斑', '疤痕', '皱纹']), select('skinFinish', '皮肤状态', 'Skin finish', ['自然', '哑光', '轻微光泽', '晒后']), select('skinDetailLevel', '细节等级', 'Skin detail level', ['柔和', '适中', '丰富']), text('skinRealism', '真实感描述', 'Skin realism'),
  ] },
  { id: 'makeup', label: '妆容配饰', enLabel: 'Makeup and accessories', fields: [
    select('makeupStyle', '妆容风格', 'Makeup style', ['素颜', '自然淡妆', '日常', '复古', '舞台', '古风', '电影感']), select('baseMakeup', '底妆', 'Base makeup', ['自然', '哑光', '轻透', '光泽']), select('eyeMakeup', '眼妆', 'Eye makeup', ['自然', '大地色', '淡眼线', '烟熏', '复古']),
    select('lipMakeup', '唇妆', 'Lip makeup', ['自然', '裸色', '豆沙色', '正红', '唇釉']), select('blush', '腮红', 'Blush', ['无', '淡粉', '珊瑚', '自然']), tags('accessories', '配饰', 'Accessories', ['眼镜', '帽子', '围巾', '发夹', '手表', '包', '手套']), tags('jewelry', '首饰', 'Jewelry', ['耳钉', '耳环', '项链', '戒指', '手链', '胸针']), text('nails', '美甲', 'Nail styling'),
  ] },
  { id: 'clothing', label: '服装造型', enLabel: 'Wardrobe', fields: [
    select('clothingCategory', '服装大类', 'Clothing category', ['日常', '正装', '古装', '职业装', '运动装', '幻想服装', '礼服']),
    select('top', '上身', 'Top', ['白衬衫', 'T恤', '运动背心', '针织衫', '卫衣', '西装外套', '风衣', '衬衫', '夹克', '汉服上衣', '盔甲']), select('bottom', '下身', 'Bottom', ['牛仔裤', '西裤', '长裙', '半身裙', '短裤', '运动裤', '长裤', '古风裙', '工装裤']), select('shoes', '鞋子', 'Shoes', ['无', '运动鞋', '皮鞋', '靴子', '高跟鞋', '帆布鞋', '凉鞋', '布鞋']), select('clothingStyle', '服装风格', 'Clothing style', ['简约', '休闲', '商务', '复古', '优雅', '运动', '古典', '未来感', '街头', '学院']),
    select('clothingColor', '颜色', 'Color', ['黑色', '白色', '灰色', '米色', '棕色', '蓝色', '红色', '绿色', '粉色', '金色']), select('material', '材质', 'Material', ['棉', '亚麻', '羊毛', '丝绸', '牛仔', '皮革', '针织', '轻纱', '金属', '科技面料']), select('fit', '贴身程度', 'Fit', ['宽松', '合身', '修身', '自然垂坠', '层次叠穿']),
    tags('exposure', '露肤范围', 'Visible skin', ['肩颈', '锁骨', '手臂', '手部', '背部', '腿部', '脚踝']), area('outfitNotes', '造型补充', 'Outfit notes'),
  ] },
  { id: 'expression', label: '表情动作', enLabel: 'Expression and movement', fields: [
    tags('expressions', '表情', 'Expressions', ['平静', '微笑', '开心', '悲伤', '惊讶', '愤怒', '紧张', '思考'], '平静，微笑，惊讶'),
    select('gesture', '动作', 'Action', ['站立', '行走', '坐下', '转身', '奔跑', '举手', '整理衣领', '阅读', '回眸']), select('pose', '姿势', 'Pose', ['自然站姿', '双臂自然下垂', '双手交叠', '叉腰', '坐姿', '侧身', '动态姿态']), select('gazeDirection', '视线方向', 'Gaze direction', ['看向镜头', '望向远方', '侧看', '低头', '抬头', '闭眼']), select('emotion', '情绪', 'Emotion', ['平静', '喜悦', '忧伤', '惊讶', '愤怒', '紧张', '思考', '自信']), select('actionIntensity', '动作强度', 'Action intensity', ['轻微', '适中', '明显']), select('emotionIntensity', '情绪强度', 'Emotional intensity', ['轻微', '适中', '强烈']), text('actionDetails', '动作细节', 'Action details'),
  ] },
  { id: 'layout', label: '设定板布局', enLabel: 'Sheet layout', fields: [
    select('aspectRatio', '画面比例', 'Aspect ratio', ['1:1', '3:4', '4:3', '9:16', '16:9', '21:9'], '16:9'),
    select('background', '背景', 'Background', ['纯色背景', '浅灰背景', '深灰背景', '纯白背景', '自然场景', '透明背景'], '纯色背景'), select('layout', '排版', 'Layout', ['清晰分区', '网格布局', '横向排列', '纵向排列', '画报式构图'], '清晰分区'), select('leftContent', '左侧内容', 'Left side', ['三视图', '全身像', '半身像', '头像', '服装展示']), select('rightContent', '右侧内容', 'Right side', ['头像', '表情', '细节图', '服装', '色卡']),
    number('detailCount', '细节图数量', 'Number of detail panels', '4'), number('shotCount', '连续分镜张数', 'Number of sequential shots', '4'),
    select('annotation', '标注选项', 'Annotation style', ['不加文字', '简洁标签', '详细标签'], '不加文字'),
    toggle('showLabels', '启用文字标注', 'Include labels'), toggle('showGuides', '启用比例线', 'Include proportion guides'), toggle('showPalette', '启用色卡', 'Include color palette'),
    area('composition', '构图描述', 'Composition'),
  ] },
  { id: 'camera', label: '镜头摄影', enLabel: 'Cinematography', fields: [
    select('shotSize', '景别', 'Shot size', ['特写', '近景', '中景', '半身', '全身', '远景', '大全景']), select('cameraAngle', '拍摄角度', 'Camera angle', ['平视', '俯视', '仰视', '正面', '侧面', '背面', '四分之三侧面']),
    select('lens', '焦段', 'Lens', ['24mm', '35mm', '50mm', '85mm', '135mm']), select('cameraStyle', '摄影风格', 'Photography style', ['自然摄影', '电影摄影', '纪实摄影', '时尚摄影', '棚拍', '胶片感']), select('lighting', '灯光', 'Lighting', ['自然光', '柔光', '侧光', '逆光', '轮廓光', '棚拍光', '霓虹灯', '烛光']), select('depthOfField', '景深', 'Depth of field', ['浅景深', '中景深', '深景深', '背景虚化']),
    select('focus', '对焦', 'Focus', ['眼睛', '面部', '全身', '服装细节', '场景']), select('cameraMotion', '镜头运动', 'Camera movement', ['固定镜头', '缓慢推进', '平移', '跟拍', '环绕', '手持']), select('sharpness', '画面清晰度', 'Image sharpness', ['自然', '清晰', '柔和', '高细节']), text('cameraColor', '摄影色调', 'Photography color tone'), text('cameraRealism', '真实感补充', 'Photography realism'),
  ] },
  { id: 'scene', label: '场景氛围', enLabel: 'Setting and atmosphere', fields: [
    select('scene', '场景', 'Setting', ['摄影棚', '街道', '咖啡馆', '办公室', '图书馆', '校园', '海边', '森林', '庭院', '宫殿', '未来城市']), text('location', '地点', 'Location'), text('city', '城市', 'City'), select('time', '时间', 'Time of day', ['清晨', '上午', '正午', '午后', '黄昏', '夜晚', '深夜']), select('weather', '天气', 'Weather', ['晴天', '多云', '阴天', '雨天', '雪天', '薄雾', '大风']),
    select('atmosphere', '氛围', 'Atmosphere', ['温暖', '宁静', '浪漫', '紧张', '神秘', '欢快', '孤独', '庄重']), select('colorMood', '色调', 'Color mood', ['暖色调', '冷色调', '中性色', '低饱和', '高对比', '柔和粉彩', '黑白']), select('backgroundComplexity', '背景复杂度', 'Background complexity', ['简洁', '适中', '丰富']), area('sceneDetails', '场景细节', 'Scene details'),
  ] },
  { id: 'detail', label: '细节图', enLabel: 'Detail panels', fields: [
    toggle('includeDetails', '启用细节图', 'Include detail panels', true),
    tags('detailTypes', '细节类型', 'Detail types', ['正面头像', '侧面头像', '手部', '鞋子', '服饰纹理', '饰品', '特殊标记']),
    text('detailClothing', '服装细节', 'Clothing details'), text('detailSkin', '皮肤细节模式', 'Skin detail style'),
  ] },
  { id: 'consistency', label: '一致性锁定', enLabel: 'Consistency locks', fields: [
    toggle('lockFace', '锁定脸型五官', 'Lock facial features', true), toggle('lockHair', '锁定发型发色', 'Lock hairstyle and color', true),
    toggle('lockBody', '锁定身材比例', 'Lock body proportions', true), toggle('lockAge', '锁定年龄感', 'Lock apparent age', true),
    toggle('lockSkin', '锁定肤色', 'Lock skin tone', true), toggle('lockMarks', '锁定特殊标记', 'Lock distinctive marks', true),
    toggle('lockClothing', '锁定服装', 'Lock wardrobe'), toggle('lockMakeup', '锁定妆容', 'Lock makeup'),
    select('consistencyStrength', '一致性强度', 'Consistency strength', ['一般', '较强', '极强'], '较强'), toggle('includeCharacterId', '显示角色 ID 摘要', 'Include character identity summary', true),
  ] },
  { id: 'format', label: '模型格式', enLabel: 'Output settings', fields: [
    select('outputLanguage', '输出语言', 'Output language', ['中文', '英文', '中英双语'], '中文'),
    select('promptFormat', '提示词格式', 'Prompt format', ['自然语言', '分组列表', '关键词'], '分组列表'),
    toggle('includeNegative', '包含负面词', 'Append negative prompt', true), toggle('includeParameters', '包含模型参数', 'Append model parameters', true),
  ] },
  { id: 'negative', label: '负面词', enLabel: 'Negative prompt', fields: [
    toggle('enableNegative', '启用负面词', 'Enable negative prompt', true), select('negativeStrength', '强度', 'Intensity', ['轻微', '标准', '严格'], '标准'),
    tags('negativeCategories', '负面词类别', 'Negative categories', ['模糊', '低清晰度', 'AI感过强', '五官错误', '肢体错误', '手部错误', '角色不一致', '乱码文字', '水印'], '模糊，低清晰度，手部错误，角色不一致，乱码文字，水印'),
    area('negativeDetails', '自定义负面词', 'Custom negative prompt'),
  ] },
  { id: 'advanced', label: '高级参数', enLabel: 'Advanced settings', fields: [
    text('weight', '权重', 'Weight'), toggle('photorealistic', '增强真实感', 'Enhance realism'), toggle('faceDetail', '增强面部细节', 'Enhance facial detail'),
    toggle('characterConsistency', '加强角色一致性', 'Strengthen consistency', true), toggle('avoidAiLook', '避免明显 AI 感', 'Avoid artificial appearance'),
    toggle('includeAdditional', '追加补充词', 'Include additional instructions', true), area('additionalPositive', '正向补充', 'Additional positive instructions'), area('additionalNegative', '负向补充', 'Additional negative instructions'),
    text('size', '画面尺寸', 'Image size'), number('steps', '采样步数', 'Sampling steps', '30'), text('cfg', 'CFG', 'CFG scale', '7'), text('sampler', '采样器', 'Sampler', 'Euler'), text('seed', '种子', 'Seed', '-1'),
  ] },
];

// Optional free-form fields use an explicit neutral value so the initial form
// is complete without inventing extra story or negative instructions.
export const UNSPECIFIED = '不指定';
const DEFAULTS: Readonly<Record<string, string>> = {
  ethnicity: '东亚', occupation: '演员', personality: '冷静，克制', beautyLevel: '突出',
  temperament: '疏离', maturity: '轻熟', presence: '冷静',
  faceShape: '鹅蛋脸', boneStructure: '立体', jawline: '清晰', cheekbones: '略高',
  eyeShape: '杏眼', eyelids: '自然双眼皮', eyeExpression: '冷静', eyeSpacing: '适中',
  eyelashes: '纤长', eyebrows: '自然眉', nose: '挺鼻梁', lips: '偏薄', lipColor: '豆沙色',
  marks: '眼角痣', baseExpression: '平静',
  hairLength: '齐肩发', hairColor: '黑色', hairStyle: '直发', hairTexture: '柔顺',
  fringe: '侧分刘海', hairEnds: '内扣', hairCondition: '整洁',
  height: '168cm', bodyType: '纤细', proportions: '腿长', shoulders: '颈部修长', waist: '纤细',
  waistHip: '匀称', legs: '修长', posture: '挺拔', musculature: '轻微运动感',
  skinTone: '白皙', undertone: '中性', skinTexture: '自然纹理', skinDetails: '自然纹理',
  skinFinish: '自然', skinDetailLevel: '适中', skinRealism: '真实毛孔',
  makeupStyle: '自然淡妆', baseMakeup: '自然', eyeMakeup: '淡眼线', lipMakeup: '豆沙色',
  blush: '自然', accessories: '发夹', jewelry: '耳钉', nails: '裸色',
  clothingCategory: '运动装', top: '运动背心', bottom: '短裤', shoes: '无', clothingStyle: '简约',
  clothingColor: '灰色', material: '棉', fit: '合身', exposure: '肩颈，锁骨，手臂，腿部',
  expressions: '平静，微笑，开心，悲伤，惊讶，愤怒，紧张，思考',
  gesture: '站立', pose: '双臂自然下垂', gazeDirection: '看向镜头', emotion: '平静',
  actionIntensity: '轻微', emotionIntensity: '轻微', leftContent: '三视图', rightContent: '头像',
  background: '浅灰背景', detailCount: '8', composition: '左侧三视图，右侧头像',
  shotSize: '全身', cameraAngle: '平视', lens: '85mm', cameraStyle: '自然摄影', lighting: '柔光',
  depthOfField: '浅景深', focus: '面部', cameraMotion: '固定镜头', sharpness: '清晰',
  cameraColor: '冷色调', cameraRealism: '自然写实', scene: '摄影棚', location: '摄影棚',
  time: '上午', atmosphere: '宁静', colorMood: '中性色', backgroundComplexity: '简洁',
  detailTypes: '正面头像，侧面头像，手部，服饰纹理，特殊标记', detailClothing: '服饰纹理', detailSkin: '自然纹理',
  lockMakeup: 'true', consistencyStrength: '极强', promptFormat: '自然语言', negativeStrength: '严格',
  photorealistic: 'true', faceDetail: 'true', avoidAiLook: 'true', weight: '1', size: '1024x576',
};

// Each candidate is a Chinese value and its English equivalent. Keeping the
// pairs together ensures the selector and generated English stay in sync.
const ADDITIONAL_OPTIONS: Readonly<Record<string, readonly (readonly [string, string])[]>> = {
  age: [['18岁', '18 years old'], ['20岁', '20 years old'], ['25岁', '25 years old'], ['30岁', '30 years old'], ['40岁', '40 years old'], ['50岁', '50 years old'], ['60岁', '60 years old']],
  height: [['150cm', '150cm'], ['155cm', '155cm'], ['160cm', '160cm'], ['165cm', '165cm'], ['168cm', '168cm'], ['170cm', '170cm'], ['175cm', '175cm'], ['180cm', '180cm'], ['185cm', '185cm'], ['190cm', '190cm']],
  temperament: [['清冷气质', 'cool and reserved temperament'], ['温润气质', 'gentle temperament'], ['沉稳气质', 'composed temperament'], ['活泼气质', 'lively temperament'], ['知性气质', 'intellectual temperament'], ['英气气质', 'confident heroic temperament'], ['慵懒气质', 'relaxed temperament'], ['神秘气质', 'mysterious temperament']],
  presence: [['温和气场', 'gentle presence'], ['坚定气场', 'assured presence'], ['松弛气场', 'relaxed presence'], ['庄重气场', 'dignified presence'], ['亲和气场', 'approachable presence'], ['凌厉气场', 'formidable presence']],
  eyelids: [['自然双眼皮', 'natural double eyelids'], ['单眼皮', 'monolids'], ['内双', 'subtle double eyelids'], ['平行双眼皮', 'parallel double eyelids'], ['自然眼睑', 'natural eyelids']],
  baseExpression: [['自然微笑', 'natural smile'], ['平静表情', 'calm expression'], ['专注神情', 'focused expression'], ['严肃神情', 'serious expression'], ['温柔神情', 'gentle expression']],
  skinRealism: [['自然皮肤纹理', 'natural skin texture'], ['可见细微毛孔', 'visible fine pores'], ['保留自然细纹', 'preserve natural fine lines'], ['柔和自然质感', 'soft natural texture']],
  nails: [['素色短甲', 'short natural nails'], ['透明裸甲', 'clear nude nails'], ['浅粉美甲', 'light pink nails'], ['简洁深色美甲', 'simple dark nails'], ['无美甲', 'no nail polish']],
  actionDetails: [['动作自然放松', 'natural and relaxed movement'], ['缓慢转身', 'turning slowly'], ['轻轻抬手', 'gently raising a hand'], ['自然整理衣领', 'naturally adjusting the collar']],
  cameraColor: [['暖调摄影', 'warm photographic tones'], ['冷调摄影', 'cool photographic tones'], ['中性摄影色调', 'neutral photographic tones'], ['复古胶片色调', 'vintage film tones']],
  cameraRealism: [['自然摄影质感', 'natural photographic texture'], ['细腻胶片颗粒', 'fine film grain'], ['真实材质细节', 'realistic material details'], ['自然光影过渡', 'natural transitions between light and shadow']],
  location: [['室内摄影棚', 'indoor studio'], ['城市街区', 'urban neighborhood'], ['海边栈道', 'seaside boardwalk'], ['校园走廊', 'school hallway'], ['山间庭院', 'mountain courtyard']],
  city: [['上海', 'Shanghai'], ['北京', 'Beijing'], ['成都', 'Chengdu'], ['香港', 'Hong Kong'], ['东京', 'Tokyo'], ['巴黎', 'Paris'], ['虚构城市', 'fictional city']],
  detailClothing: [['服装缝线', 'garment stitching'], ['布料纹理', 'fabric texture'], ['领口结构', 'collar construction'], ['袖口细节', 'cuff details'], ['衣物层次', 'clothing layers']],
  detailSkin: [['自然毛孔细节', 'natural pore detail'], ['自然雀斑细节', 'natural freckle detail'], ['柔和皮肤纹理', 'soft skin texture'], ['保留真实细节', 'preserve realistic details']],
  occupation: [['航天工程师', 'aerospace engineer'], ['消防员', 'firefighter'], ['摄影师', 'photographer'], ['音乐人', 'musician'], ['舞蹈演员', 'dancer'], ['运动员', 'athlete'], ['兽医', 'veterinarian'], ['园艺师', 'gardener'], ['程序员', 'software developer'], ['考古学家', 'archaeologist'], ['画家', 'painter'], ['飞行员', 'pilot'], ['船长', 'ship captain'], ['药师', 'pharmacist'], ['店主', 'shop owner'], ['图书管理员', 'librarian']],
  regionalStyle: [['民国城市', 'Republican-era Chinese city'], ['东方仙侠', 'East Asian fantasy'], ['西部荒野', 'western frontier'], ['海滨小镇', 'coastal town'], ['蒸汽时代', 'steampunk era'], ['近未来空间站', 'near-future space station']],
  genre: [['武侠', 'martial arts drama'], ['仙侠', 'immortal fantasy'], ['家庭', 'family drama'], ['职场', 'workplace drama'], ['冒险', 'adventure'], ['战争', 'war drama'], ['公路', 'road story'], ['治愈', 'healing drama']],
  rolePosition: [['反派', 'antagonist'], ['搭档', 'partner'], ['领袖', 'leader'], ['探索者', 'explorer'], ['旁观者', 'observer'], ['守护者', 'guardian']],
  personality: [['果断', 'decisive'], ['沉稳', 'composed'], ['热忱', 'enthusiastic'], ['谨慎', 'cautious'], ['乐观', 'optimistic'], ['执着', 'persistent'], ['善良', 'kind'], ['机敏', 'quick-witted'], ['独立', 'independent'], ['叛逆', 'rebellious'], ['坦率', 'straightforward'], ['细心', 'attentive']],
  beautyDirection: [['英气', 'heroic features'], ['少年气', 'youthful appearance'], ['沧桑', 'weathered appearance'], ['亲和', 'approachable appearance'], ['冷峻', 'stern appearance'], ['中性美', 'androgynous beauty']],
  maturity: [['儿童', 'childlike age impression'], ['中年', 'middle-aged'], ['老年', 'elderly'], ['成熟稳重', 'mature and composed']],
  faceShape: [['梨形脸', 'pear-shaped face'], ['椭圆长脸', 'elongated oval face'], ['宽方脸', 'broad square face'], ['窄长脸', 'narrow long face'], ['倒三角脸', 'inverted triangle face']],
  boneStructure: [['柔和颧弓', 'soft cheekbone contours'], ['突出眉骨', 'prominent brow ridge'], ['深邃骨相', 'deep-set facial structure'], ['平缓骨相', 'subtle facial structure']],
  jawline: [['圆润下颌', 'rounded jaw'], ['宽阔下颌', 'broad jaw'], ['柔和下颌', 'soft jawline'], ['利落下颌', 'defined jawline']],
  eyeShape: [['桃花眼', 'almond eyes with upturned corners'], ['内双眼', 'subtle double eyelids'], ['细圆眼', 'narrow rounded eyes'], ['深邃眼', 'deep-set eyes'], ['上挑眼', 'upturned eyes'], ['下垂眼角', 'downturned eye corners']],
  eyeExpression: [['沉思目光', 'contemplative gaze'], ['温暖目光', 'warm gaze'], ['警觉目光', 'alert gaze'], ['坚定目光', 'resolute gaze'], ['疲惫目光', 'tired gaze'], ['俏皮目光', 'playful gaze']],
  eyebrows: [['上扬眉', 'upward-angled brows'], ['短粗眉', 'short thick brows'], ['自然浓眉', 'naturally thick brows'], ['柔和平眉', 'soft straight brows']],
  nose: [['鹰钩鼻', 'aquiline nose'], ['高鼻梁', 'high nose bridge'], ['低鼻梁', 'low nose bridge'], ['宽鼻梁', 'broad nose bridge'], ['笔直鼻梁', 'straight nose bridge']],
  lips: [['薄唇', 'thin lips'], ['厚唇', 'full lips'], ['上唇较薄', 'thinner upper lip'], ['嘴角上扬', 'upturned mouth corners'], ['自然唇峰', 'natural cupid’s bow']],
  marks: [['左眉小疤', 'small scar on left eyebrow'], ['右颊酒窝', 'dimple on right cheek'], ['鼻梁雀斑', 'freckles across the nose'], ['下巴小痣', 'small beauty mark on chin'], ['右眼角痣', 'beauty mark near right eye'], ['左颊浅疤', 'faint scar on left cheek']],
  hairLength: [['寸头', 'buzz cut'], ['耳上短发', 'short hair above ears'], ['及腰长发', 'waist-length hair'], ['及肩中发', 'shoulder-length medium hair']],
  hairColor: [['亚麻棕', 'ash brown hair'], ['栗棕色', 'chestnut brown hair'], ['乌黑', 'jet black hair'], ['灰白色', 'gray-white hair'], ['铜红色', 'copper red hair'], ['深紫色', 'deep purple hair'], ['墨蓝色', 'dark blue hair'], ['双色挑染', 'two-tone highlights']],
  hairStyle: [['背头', 'slicked-back hair'], ['寸头造型', 'buzz-cut hairstyle'], ['油头', 'slick pompadour'], ['中分短发', 'center-parted short hair'], ['低马尾', 'low ponytail'], ['高马尾', 'high ponytail'], ['低盘发', 'low bun'], ['麻花辫', 'braided pigtails'], ['自然卷短发', 'short natural curls'], ['狼尾发', 'wolf cut'], ['波波头', 'bob haircut'], ['法式卷发', 'French curls']],
  fringe: [['中分刘海', 'center-parted fringe'], ['斜刘海', 'side-swept bangs'], ['眉上刘海', 'short fringe above eyebrows'], ['卷曲刘海', 'curly fringe']],
  bodyType: [['宽肩健壮', 'broad-shouldered athletic build'], ['清瘦', 'lean build'], ['中等体型', 'medium build'], ['魁梧', 'sturdy build'], ['圆润体型', 'rounded build'], ['肌肉型', 'muscular build']],
  posture: [['背部挺直', 'straight-backed posture'], ['略微驼背', 'slightly stooped posture'], ['步伐稳健', 'steady stride'], ['身体微侧', 'body turned slightly sideways']],
  skinTone: [['蜜糖色', 'honey skin tone'], ['暖棕色肤色', 'warm brown skin tone'], ['深棕色肤色', 'deep brown skin tone'], ['冷白肤色', 'cool fair skin tone'], ['橄榄色肤色', 'olive skin tone']],
  skinDetails: [['自然雀斑', 'natural freckles'], ['轻微细纹', 'subtle fine lines'], ['小片疤痕', 'small scar'], ['晒斑', 'sunspots'], ['自然痘印', 'natural acne marks']],
  makeupStyle: [['清透裸妆', 'sheer nude makeup'], ['成熟商务妆', 'mature business makeup'], ['复古红唇妆', 'vintage red-lip makeup'], ['舞台烟熏妆', 'stage smoky makeup'], ['自然男士妆', 'natural masculine makeup']],
  accessories: [['领带', 'neck tie'], ['领结', 'bow tie'], ['腰带', 'belt'], ['背包', 'backpack'], ['相机', 'camera'], ['雨伞', 'umbrella'], ['头巾', 'headscarf'], ['发箍', 'headband'], ['袖扣', 'cufflinks']],
  jewelry: [['怀表', 'pocket watch'], ['吊坠', 'pendant'], ['耳夹', 'ear cuff'], ['发簪', 'hairpin'], ['腕表', 'wristwatch']],
  clothingCategory: [['户外装备', 'outdoor apparel'], ['工装造型', 'workwear outfit'], ['传统服饰', 'traditional costume'], ['校园服饰', 'school outfit'], ['舞台服饰', 'stage costume']],
  top: [['飞行夹克', 'bomber jacket'], ['皮夹克', 'leather jacket'], ['牛仔外套', 'denim jacket'], ['高领毛衣', 'turtleneck sweater'], ['连帽外套', 'hooded jacket'], ['短袖衬衫', 'short-sleeved shirt'], ['工装马甲', 'workwear vest'], ['长款大衣', 'long coat'], ['棒球外套', 'varsity jacket'], ['连衣裙', 'dress'], ['西装马甲', 'suit vest'], ['防风外套', 'windbreaker']],
  bottom: [['直筒牛仔裤', 'straight-leg jeans'], ['阔腿长裤', 'wide-leg trousers'], ['百褶裙', 'pleated skirt'], ['及膝裙', 'knee-length skirt'], ['休闲短裤', 'casual shorts'], ['西装短裤', 'tailored shorts'], ['锥形长裤', 'tapered trousers'], ['骑行裤', 'cycling shorts'], ['长款礼裙', 'long formal skirt']],
  shoes: [['短靴', 'ankle boots'], ['长靴', 'knee-high boots'], ['乐福鞋', 'loafers'], ['马丁靴', 'lace-up boots'], ['平底鞋', 'flat shoes'], ['户外登山鞋', 'hiking boots'], ['芭蕾鞋', 'ballet flats'], ['拖鞋', 'slippers']],
  clothingStyle: [['现代通勤', 'modern commuter style'], ['复古港风', 'vintage Hong Kong style'], ['户外机能', 'technical outdoor style'], ['轻商务', 'smart business style'], ['极简日常', 'minimal everyday style'], ['宫廷风', 'court-inspired style'], ['摇滚风', 'rock-inspired style'], ['田园风', 'cottage style']],
  clothingColor: [['藏蓝色', 'navy blue'], ['卡其色', 'khaki'], ['墨绿色', 'dark green'], ['酒红色', 'burgundy'], ['雾蓝色', 'dusty blue'], ['奶油白', 'cream white'], ['炭灰色', 'charcoal gray'], ['浅紫色', 'light purple']],
  material: [['灯芯绒', 'corduroy'], ['涤纶', 'polyester'], ['天鹅绒', 'velvet'], ['雪纺', 'chiffon'], ['毛呢', 'wool blend'], ['帆布', 'canvas fabric'], ['网眼织物', 'mesh fabric']],
  fit: [['宽肩版型', 'broad-shouldered fit'], ['直筒版型', 'straight silhouette'], ['短款版型', 'cropped fit'], ['长款版型', 'longline fit'], ['垂坠版型', 'draped fit']],
  expressions: [['轻笑', 'gentle smile'], ['大笑', 'laughing'], ['疑惑', 'puzzled'], ['害羞', 'shy'], ['专注思考', 'deep in thought'], ['松一口气', 'relieved'], ['担忧', 'worried'], ['严肃', 'serious']],
  gesture: [['整理头发', 'adjusting hair'], ['挥手', 'waving'], ['双手插兜', 'hands in pockets'], ['拿着书', 'holding a book'], ['提着包', 'carrying a bag'], ['扶眼镜', 'adjusting glasses'], ['推开门', 'opening a door'], ['倚靠墙面', 'leaning against a wall']],
  pose: [['双手背后', 'hands behind back'], ['单手插兜', 'one hand in pocket'], ['双臂交叉', 'arms crossed'], ['自然坐姿', 'natural seated pose'], ['行走姿态', 'walking pose'], ['半蹲姿态', 'crouching pose']],
  gazeDirection: [['看向左侧', 'looking left'], ['看向右侧', 'looking right'], ['看向地面', 'looking at the ground'], ['望向窗外', 'looking out of a window']],
  background: [['米白背景', 'warm white background'], ['深蓝背景', 'deep blue background'], ['纯黑背景', 'black background'], ['虚化室内背景', 'blurred indoor background'], ['渐变背景', 'gradient background']],
  layout: [['左右双栏', 'two-column layout'], ['九宫格排版', 'nine-panel grid'], ['上下一体布局', 'stacked layout'], ['留白排版', 'layout with generous whitespace']],
  shotSize: [['面部大特写', 'extreme close-up of face'], ['膝上中景', 'three-quarter length shot'], ['人物远景', 'long shot of character'], ['环境全景', 'wide environmental shot']],
  cameraAngle: [['低角度仰拍', 'low-angle shot'], ['高角度俯拍', 'high-angle shot'], ['斜侧视角', 'oblique angle'], ['过肩视角', 'over-the-shoulder view'], ['主观视角', 'point-of-view shot']],
  lens: [['14mm', '14mm'], ['18mm', '18mm'], ['28mm', '28mm'], ['70mm', '70mm'], ['105mm', '105mm'], ['200mm', '200mm']],
  cameraStyle: [['黑白摄影', 'black-and-white photography'], ['胶片纪实', 'documentary film photography'], ['时尚大片', 'fashion editorial photography'], ['舞台摄影', 'stage photography'], ['环境人像', 'environmental portraiture']],
  lighting: [['伦勃朗光', 'Rembrandt lighting'], ['蝴蝶光', 'butterfly lighting'], ['窗边柔光', 'soft window light'], ['黄金时刻光线', 'golden-hour light'], ['阴天散射光', 'overcast diffuse light'], ['硬质顶光', 'hard overhead lighting'], ['蓝调时刻光线', 'blue-hour light'], ['彩色舞台光', 'colored stage lighting']],
  depthOfField: [['极浅景深', 'very shallow depth of field'], ['人物清晰背景柔化', 'sharp subject with softened background'], ['前后景均清晰', 'sharp foreground and background']],
  cameraMotion: [['缓慢拉远', 'slow pullback'], ['向左平移', 'pan left'], ['向右平移', 'pan right'], ['垂直升降', 'vertical camera movement'], ['肩扛跟拍', 'shoulder-mounted tracking shot']],
  scene: [['地铁站', 'subway station'], ['火车站', 'train station'], ['城市天台', 'city rooftop'], ['医院走廊', 'hospital corridor'], ['雨夜街道', 'rainy night street'], ['书店', 'bookstore'], ['厨房', 'kitchen'], ['音乐厅', 'concert hall'], ['山间小路', 'mountain trail'], ['湖边', 'lakeside'], ['旧工厂', 'abandoned factory'], ['太空舱', 'space capsule'], ['古城街巷', 'ancient city alley'], ['花园', 'garden']],
  time: [['日出时分', 'at sunrise'], ['日落时分', 'at sunset'], ['蓝调时刻', 'during blue hour'], ['黎明前', 'before dawn']],
  weather: [['细雨', 'light rain'], ['暴雨', 'heavy rain'], ['雪后', 'after snowfall'], ['晨雾', 'morning fog'], ['雨后', 'after rain'], ['晴朗微风', 'clear with a light breeze']],
  atmosphere: [['温馨', 'cozy'], ['压抑', 'oppressive'], ['悬疑感', 'suspenseful'], ['怀旧', 'nostalgic'], ['轻松', 'lighthearted'], ['史诗感', 'epic atmosphere'], ['孤寂', 'solitary']],
  colorMood: [['暖棕色调', 'warm brown palette'], ['蓝绿色调', 'teal palette'], ['奶油色调', 'cream palette'], ['霓虹色调', 'neon palette'], ['复古褪色', 'faded vintage palette']],
  detailTypes: [['眼睛特写', 'eye close-up'], ['手部细节', 'hand detail'], ['鞋履细节', 'footwear detail'], ['发型细节', 'hair detail'], ['配饰细节', 'accessory detail'], ['服装背面', 'back of garment']],
  negativeCategories: [['重复人物', 'duplicate characters'], ['多余手指', 'extra fingers'], ['比例失衡', 'distorted proportions'], ['画面过曝', 'overexposure'], ['背景杂乱', 'cluttered background'], ['色彩失真', 'inaccurate colors'], ['服装穿帮', 'wardrobe continuity errors'], ['面部变形', 'facial distortion']],
};

export const EXTRA_OPTION_TRANSLATIONS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.values(ADDITIONAL_OPTIONS).flat().map(([option, english]) => [option, english]),
);

export const GROUPS: readonly CharacterGroup[] = BASE_GROUPS.map(group => ({
  ...group,
  fields: group.fields.map(field => ({
    ...field,
    ...(field.type === 'text' && ADDITIONAL_OPTIONS[field.id] ? { type: 'select' as const } : {}),
    defaultValue: DEFAULTS[field.id] ?? (field.defaultValue || UNSPECIFIED),
    ...(field.options || ADDITIONAL_OPTIONS[field.id] ? { options: [...new Set([...(field.options ?? []), ...(ADDITIONAL_OPTIONS[field.id] ?? []).map(([option]) => option)])] } : {}),
  })),
}));

export function createInitialValues(): CharacterValues {
  return Object.fromEntries(GROUPS.flatMap(group => group.fields.map(field => [field.id, field.defaultValue])));
}
