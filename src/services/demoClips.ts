import { VideoClip } from '../types';

export const DEMO_HOOKS: VideoClip[] = [
  {
    id: 'hook-1',
    type: 'hook',
    title: 'Gancho 01: Choque & Interrupção de Padrão',
    duration: 3.8,
    fileSize: '4.2 MB',
    colorTheme: '#7c3aed',
    subtitleText: 'Para tudo! Não compre nada antes de ver esse teste real!',
    demoData: {
      gradient: ['#4c1d95', '#831843'],
      badgeText: 'GANCHO 01 (3.8s)',
      actionText: 'NÃO COMPRE ISSO ANTES DE VER!',
      subText: 'Criador segurando o produto chocado com a reação',
    },
  },
  {
    id: 'hook-2',
    type: 'hook',
    title: 'Gancho 02: Comparação Lado a Lado (POV)',
    duration: 4.2,
    fileSize: '4.8 MB',
    colorTheme: '#2563eb',
    subtitleText: 'Eu jogava dinheiro fora todo mês até descobrir esse truque!',
    demoData: {
      gradient: ['#1e3a8a', '#3b0764'],
      badgeText: 'GANCHO 02 (4.2s)',
      actionText: 'MÉTODO ANTIGO vs NOVO JEITO',
      subText: 'Comparação em tela dividida mostrando frustração vs alívio',
    },
  },
  {
    id: 'hook-3',
    type: 'hook',
    title: 'Gancho 03: Revelação de Segredo Proibido',
    duration: 3.5,
    fileSize: '3.9 MB',
    colorTheme: '#059669',
    subtitleText: 'O segredo que as grandes marcas não querem que você saiba!',
    demoData: {
      gradient: ['#064e3b', '#1e1b4b'],
      badgeText: 'GANCHO 03 (3.5s)',
      actionText: 'O SEGREDO QUE NÃO TE CONTAM...',
      subText: 'Voz sussurrada e zoom rápido na embalagem do produto',
    },
  },
];

export const DEMO_BODIES: VideoClip[] = [
  {
    id: 'body-1',
    type: 'body',
    title: 'Corpo 01: Teste Extremo ao Vivo',
    duration: 6.5,
    fileSize: '7.1 MB',
    colorTheme: '#d97706',
    subtitleText: 'Olha na prática como funciona em segundos sem nenhum esforço e com acabamento impecável.',
    demoData: {
      gradient: ['#78350f', '#831843'],
      badgeText: 'CORPO 01 (6.5s)',
      actionText: 'TESTANDO NA PRÁTICA EM TEMPO REAL',
      subText: 'Demonstração de alta retenção com close no mecanismo funcionando',
    },
  },
  {
    id: 'body-2',
    type: 'body',
    title: 'Corpo 02: 3 Motivos Pelos Quais Vale a Pena',
    duration: 7.0,
    fileSize: '8.3 MB',
    colorTheme: '#0891b2',
    subtitleText: 'Primeiro: economiza horas do seu dia. Segundo: dura anos. Terceiro: custa metade do preço!',
    demoData: {
      gradient: ['#164e63', '#312e81'],
      badgeText: 'CORPO 02 (7.0s)',
      actionText: '3 BENEFÍCIOS QUE MUDAM TUDO',
      subText: 'Contagem nos dedos e cortes rápidos destacando usabilidade diária',
    },
  },
  {
    id: 'body-3',
    type: 'body',
    title: 'Corpo 03: Desembalagem & Primeira Impressão',
    duration: 5.8,
    fileSize: '6.4 MB',
    colorTheme: '#db2777',
    subtitleText: 'Quando abri a caixa fiquei impressionado com a potência e a qualidade real de cada detalhe.',
    demoData: {
      gradient: ['#831843', '#1e1b4b'],
      badgeText: 'CORPO 03 (5.8s)',
      actionText: 'UNBOXING & ACABAMENTO PREMIUM',
      subText: 'Texturas, som satisfatório e sensação de item de luxo por preço baixo',
    },
  },
];

export const DEMO_CTAS: VideoClip[] = [
  {
    id: 'cta-1',
    type: 'cta',
    title: 'CTA 01: Urgência do Carrinho Laranja',
    duration: 3.2,
    fileSize: '3.6 MB',
    colorTheme: '#ea580c',
    subtitleText: 'Clica agora no carrinho laranja aqui embaixo com frete grátis!',
    demoData: {
      gradient: ['#7c2d12', '#4c1d95'],
      badgeText: 'CTA 01 (3.2s)',
      actionText: 'CLICA NO CARRINHO LARANJA AQUI EMBAIXO',
      subText: 'Apontando para a sacola do TikTok Shop com selo de frete grátis',
    },
  },
  {
    id: 'cta-2',
    type: 'cta',
    title: 'CTA 02: Alerta de Últimas Unidades',
    duration: 3.5,
    fileSize: '4.0 MB',
    colorTheme: '#dc2626',
    subtitleText: 'Corre porque o lote promocional no Brasil está acabando hoje!',
    demoData: {
      gradient: ['#7f1d1d', '#581c87'],
      badgeText: 'CTA 02 (3.5s)',
      actionText: 'ESTOQUE QUASE ZERADO NO BRASIL!',
      subText: 'Cronômetro regressivo e recomendação de compra urgente',
    },
  },
  {
    id: 'cta-3',
    type: 'cta',
    title: 'CTA 03: Garantia Blindada & Cupom Especial',
    duration: 3.0,
    fileSize: '3.4 MB',
    colorTheme: '#16a34a',
    subtitleText: 'Aproveita o desconto de primeira compra com garantia total no link!',
    demoData: {
      gradient: ['#14532d', '#1e1b4b'],
      badgeText: 'CTA 03 (3.0s)',
      actionText: 'GARANTIA TOTAL OU DINHEIRO DE VOLTA',
      subText: 'Selo de segurança e cupom de primeira compra no app',
    },
  },
];

export const DEFAULT_HEADLINES = [
  'NÃO COMPRE ANTES DE VER ESSE TESTE!',
  'ISSO DEVERIA SER PROIBIDO DE TÃO BARATO',
  'O ACHADINHO MAIS BIZARRO E ÚTIL DO TIKTOK',
  'TESTEI POR 7 DIAS E ME SURPREENDI DEMAIS',
  'COMO NINGUÉM DESCOBRIU ISSO ANTES NO BRASIL?',
];

export function generateRandomHexHash(): string {
  const chars = '0123456789ABCDEF';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export function generateMicroEdit() {
  // Zoom: 1.01x to 1.04x
  const zoom = Number((1.01 + Math.random() * 0.03).toFixed(3));
  // Speed: 0.98x to 1.02x
  const speed = Number((0.98 + Math.random() * 0.04).toFixed(3));
  // Brightness: -0.02 to +0.02
  const brightness = Number((-0.02 + Math.random() * 0.04).toFixed(3));
  // Saturation: -0.02 to +0.02
  const saturation = Number((-0.02 + Math.random() * 0.04).toFixed(3));
  // Unique 8 hex characters
  const hashHex = generateRandomHexHash();

  return { zoom, speed, brightness, saturation, hashHex };
}
