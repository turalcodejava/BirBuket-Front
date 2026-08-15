import { GoogleGenAI } from "@google/genai";
import { BouquetConfiguration } from "../types";

const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;
const geminiImageModels = (
  process.env.NEXT_PUBLIC_GEMINI_IMAGE_MODELS ||
  'gemini-2.5-flash-image,gemini-3.1-flash-image-preview'
)
  .split(',')
  .map((m: string) => m.trim())
  .filter(Boolean);

function getFlowerHex(color?: string) {
  switch ((color || '').toUpperCase()) {
    case 'RED':
      return '#ef4444';
    case 'PINK':
      return '#f472b6';
    case 'YELLOW':
      return '#facc15';
    case 'WHITE':
      return '#f8fafc';
    case 'BLUE':
      return '#3b82f6';
    default:
      return '#e879f9';
  }
}

function colorLabel(color?: string) {
  switch ((color || '').toUpperCase()) {
    case 'RED':
      return 'red';
    case 'PINK':
      return 'pink';
    case 'YELLOW':
      return 'yellow';
    case 'WHITE':
      return 'white';
    case 'BLUE':
      return 'blue';
    default:
      return 'pink';
  }
}

function inferFlowerSpecies(rawName?: string): string {
  const name = (rawName || '').toLowerCase();
  if (!name) return 'flowers';

  // Azerbaijani + common EN aliases
  if (/qızılgül|qirmizigul|qirmizi gul|rose|roses|gül\b/.test(name)) return 'roses';
  if (/lalə|lale|tulip|tulips/.test(name)) return 'tulips';
  if (/pion|peony|peonies/.test(name)) return 'peonies';
  if (/gerbera|gerber|daisy|daisies/.test(name)) return 'gerberas';
  if (/zanbaq|zanbaq|lily|lilies/.test(name)) return 'lilies';
  if (/orkide|orchid|orchids/.test(name)) return 'orchids';
  if (/xrizantem|chrysanthemum|mum\b/.test(name)) return 'chrysanthemums';
  if (/karanfil|carnation|carnations/.test(name)) return 'carnations';
  if (/hydrangea|hortensia/.test(name)) return 'hydrangeas';
  if (/gypsophila|baby'?s breath/.test(name)) return "baby's breath";
  if (/ranunkulus|ranunculus/.test(name)) return 'ranunculus';
  if (/anemon|anemone/.test(name)) return 'anemones';

  return 'flowers';
}

function inferColorFromName(rawName?: string): string | null {
  const name = (rawName || '').toLowerCase();
  if (!name) return null;
  if (/qırmızı|qirmizi|red|bordo|burgundy|crimson/.test(name)) return 'red';
  if (/ağ|ag\b|white|ivory|cream|krem/.test(name)) return 'white';
  if (/çəhrayı|cehrayi|pink|pembe|rose\b/.test(name)) return 'pink';
  if (/sarı|sari|yellow|gold/.test(name)) return 'yellow';
  if (/bənövşəyi|benovseyi|purple|violet|lilac/.test(name)) return 'purple';
  if (/mavi|blue/.test(name)) return 'blue';
  if (/narıncı|narinci|orange/.test(name)) return 'orange';
  return null;
}

function generateLocalBouquetImage(config: BouquetConfiguration) {
  const dominant = [...config.flowers].sort((a, b) => b.quantity - a.quantity)[0]?.flower?.name || '';
  const isBox = config.material.type === 'Qutu';
  const isHeart = (config.shape.name || '').toLowerCase().includes('ürək');

  const realisticPhotos: string[] = [
    'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?q=90&w=1400&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1548802673-380ab8ebc7b7?q=90&w=1400&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1563241527-3004b7be0941?q=90&w=1400&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1591886960571-74d43a903615?q=90&w=1400&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1519378058457-4c29a0a2efac?q=90&w=1400&auto=format&fit=crop'
  ];

  if (dominant.includes('Qızılgül') && isHeart) {
    return 'https://images.unsplash.com/photo-1525310238806-e0f779774577?q=90&w=1400&auto=format&fit=crop';
  }
  if (dominant.includes('Lalə')) {
    return 'https://images.unsplash.com/photo-1579344405400-0925af18abfb?q=90&w=1400&auto=format&fit=crop';
  }
  if (dominant.includes('Pion')) {
    return 'https://images.unsplash.com/photo-1563241527-3004b7be0941?q=90&w=1400&auto=format&fit=crop';
  }
  if (isBox) {
    return 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=90&w=1400&auto=format&fit=crop';
  }

  const colorScore = config.flowers.reduce((sum, f) => sum + getFlowerHex((f.flower as any).color).charCodeAt(1), 0);
  return realisticPhotos[colorScore % realisticPhotos.length];
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    promise
      .then((value) => {
        clearTimeout(id);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(id);
        reject(err);
      });
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getBouquetAnalysis(config: BouquetConfiguration) {
  if (!ai) {
    return {
      title: "Özəl Dizayn",
      description: "Sizin tərəfinizdən zövqlə hazırlanmış fərdi kompozisiya."
    };
  }

  const flowerList = config.flowers
    .map(f => `${f.quantity} ədəd ${f.flower.name}`)
    .join(", ");
  
  const materialInfo = `${config.material.colorName} rəngli ${config.material.type}`;
  const ribbonInfo = `${config.ribbonColor.name} lent`;
  
  const prompt = `Mən belə bir buket hazırladım: ${flowerList}. 
  Buketin forması: ${config.shape.name}. 
  Qablaşdırma: ${materialInfo}. 
  Lent: ${ribbonInfo}. 
  Bu buketin mənası haqqında çox qısa (maksimum 2 cümlə) Azərbaycan dilində romantik və ya ruhlandırıcı bir təsvir yaz və buketə maraqlı bir ad ver.
  JSON formatında qaytar: { "title": "...", "description": "..." }`;

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      }),
      12000
    );

    const text = response.text || "{}";
    const result = JSON.parse(text);
    if (result?.title && result?.description) return result;
    return {
      title: "Özəl Dizayn",
      description: "Sizin tərəfinizdən zövqlə hazırlanmış fərdi kompozisiya."
    };
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return { 
      title: "Özəl Dizayn", 
      description: "Sizin tərəfinizdən zövqlə hazırlanmış fərdi kompozisiya." 
    };
  }
}

export async function generateBouquetImage(config: BouquetConfiguration) {
  if (!ai) return generateLocalBouquetImage(config);

  const flowerList = config.flowers
    .map((f) => {
      const species = inferFlowerSpecies(f.flower.name);
      const color = colorLabel((f.flower as any).color) || inferColorFromName(f.flower.name) || 'mixed';
      return `${f.quantity} stems of ${color} ${species}`;
    })
    .join(", ");

  const strictFlowerRules = config.flowers
    .map((f) => {
      const species = inferFlowerSpecies(f.flower.name);
      const color = colorLabel((f.flower as any).color) || inferColorFromName(f.flower.name) || 'mixed';
      return `- ${f.quantity}x ${species} in ${color} tone (source: "${f.flower.name}")`;
    })
    .join('\n');
  
  const wrappingDetail = `${config.material.colorName} ${config.material.type === 'Qutu' ? 'gift box' : 'wrapping paper'}`;
  const ribbonDetail = `a ${config.ribbonColor.name} ribbon`;

  const prompt = `Ultra-realistic DSLR studio product photo of a handcrafted luxury flower bouquet with ${flowerList}.
  Bouquet arrangement style: ${config.shape.name}. Packaging: ${wrappingDetail}. Ribbon: ${ribbonDetail}.
  Strict flower composition (must follow exactly, no substitutions):
${strictFlowerRules}
  Use the requested flower names and colors as top priority.
  Do not add unrelated flower species, do not change dominant colors, and do not output random mixed bouquet.
  Cinematic softbox lighting, high dynamic range, shallow depth of field, natural petal texture, physically accurate shadows,
  premium ecommerce look, centered composition, clean neutral background, no text, no watermark, no logo, no frame.`;

  try {
    for (const model of geminiImageModels) {
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          const response = await withTimeout(
            ai.models.generateContent({
              model,
              contents: {
                parts: [{ text: prompt }],
              },
              config: {
                imageConfig: {
                  aspectRatio: "1:1"
                }
              }
            }),
            24000
          );

          if (response && response.candidates && response.candidates[0].content.parts) {
            for (const part of response.candidates[0].content.parts) {
              if (part.inlineData) {
                return `data:image/png;base64,${part.inlineData.data}`;
              }
            }
          }
        } catch (modelError: any) {
          const status = modelError?.status || modelError?.error?.code || modelError?.code;
          const message = String(modelError?.message || '');
          const transientFailure =
            status === 503 ||
            /unavailable|high demand|timeout/i.test(message);
          console.warn(`Image model failed: ${model} (attempt ${attempt})`, modelError);
          if (!transientFailure || attempt === 2) break;
          await sleep(700 * attempt);
        }
      }
    }
    
    return generateLocalBouquetImage(config);
  } catch (error) {
    console.error("Final Image Generation Error:", error);
    return generateLocalBouquetImage(config);
  }
}

export async function getPlantDoctorAdvice(params: {
  plantType: string;
  symptoms: string;
  imageBase64?: string;
  imageMimeType?: string;
}) {
  const fallback = {
    summary: "İlkin diaqnoz üçün məlumat alındı.",
    possibleIssues: [
      "Həddindən artıq və ya az sulama",
      "İşıq balansının düzgün olmaması",
      "Torpaq və qida çatışmazlığı"
    ],
    carePlan: [
      "Torpağın üst qatı quruduqdan sonra sulayın.",
      "Bitkini birbaşa olmayan parlaq işığa yerləşdirin.",
      "Həftəlik yarpaqları yoxlayın və zədələnmiş hissələri təmizləyin."
    ],
    urgency: "LOW" as "LOW" | "MEDIUM" | "HIGH"
  };

  if (!ai) return fallback;

  const prompt = `Sən təcrübəli bitki həkimisən. Azərbaycan dilində qısa və praktik cavab ver.
Bitki növü: ${params.plantType || "Bilinmir"}
Simptomlar: ${params.symptoms || "Qeyd edilməyib"}

JSON formatında cavab qaytar:
{
  "summary": "1-2 cümləlik ilkin diaqnoz",
  "possibleIssues": ["maksimum 3 səbəb"],
  "carePlan": ["maksimum 4 konkret addım"],
  "urgency": "LOW|MEDIUM|HIGH"
}`;

  try {
    const parts: any[] = [{ text: prompt }];
    if (params.imageBase64 && params.imageMimeType) {
      parts.push({
        inlineData: {
          data: params.imageBase64,
          mimeType: params.imageMimeType
        }
      });
    }

    const response = await withTimeout(
      ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts }],
        config: {
          responseMimeType: "application/json"
        }
      }),
      15000
    );

    const text = response.text || "{}";
    const parsed = JSON.parse(text);
    if (!parsed?.summary) return fallback;

    return {
      summary: parsed.summary,
      possibleIssues: Array.isArray(parsed.possibleIssues) ? parsed.possibleIssues.slice(0, 3) : fallback.possibleIssues,
      carePlan: Array.isArray(parsed.carePlan) ? parsed.carePlan.slice(0, 4) : fallback.carePlan,
      urgency: ["LOW", "MEDIUM", "HIGH"].includes(parsed.urgency) ? parsed.urgency : fallback.urgency
    };
  } catch (error) {
    console.error("Plant doctor AI error:", error);
    return fallback;
  }
}
