// 2026年A股主赛道
const HOT_SECTORS = [
  { theme: 'AI与大模型', keywords: ['人工智能', 'AI', '大模型', '算法', 'AIGC', '语言模型', '云计算', '智算', '算力'] },
  { theme: '人形机器人', keywords: ['机器人', '人形', '减速器', '伺服', '谐波', '执行器', '传感器', '自动化'] },
  { theme: '低空经济', keywords: ['低空', '无人机', 'eVTOL', '飞行汽车', '通用航空', '直升机', '航空发动机'] },
  { theme: '算力与光模块', keywords: ['光模块', '交换机', '数据中心', '服务器', '液冷', '800G', 'IDC'] },
  { theme: '半导体与芯片', keywords: ['半导体', '芯片', '集成电路', '晶圆', '封装', '光刻', 'GPU', 'EDA', '存储'] },
  { theme: '新能源与固态电池', keywords: ['新能源', '固态电池', '锂电', '磷酸铁锂', '三元', '充电桩', '储能', '电池'] },
  { theme: '创新药与医药', keywords: ['创新药', '生物医药', 'ADC', 'mRNA', 'CXO', '基因', '细胞治疗', '医疗器械'] },
  { theme: '卫星通信', keywords: ['卫星', '低轨', '北斗', '天地一体', '卫星互联网'] },
  { theme: '军工国防', keywords: ['军工', '国防', '航天', '导弹', '雷达', '船舶', '兵器'] },
  { theme: '华为产业链', keywords: ['华为', '鸿蒙', '麒麟', '盘古', '欧拉'] },
];

export interface SectorResult {
  isHot: boolean;
  theme: string | null;
  industry: string;
  reason: string;
}

export function analyzeSector(industry: string, stockName = ''): SectorResult {
  const text = `${industry} ${stockName}`;
  for (const s of HOT_SECTORS) {
    if (s.keywords.some(kw => text.includes(kw))) {
      return { isHot: true, theme: s.theme, industry, reason: `属于「${s.theme}」赛道，是2026年市场重点关注方向` };
    }
  }
  return { isHot: false, theme: null, industry, reason: `属于「${industry}」行业，目前不在主流热门赛道，需跟随大盘` };
}
