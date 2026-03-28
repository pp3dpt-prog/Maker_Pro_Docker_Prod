import { exec } from 'child_process';
import { promisify } from 'util';
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const execPromise = promisify(exec);

// Mapeamento de fontes para o OpenSCAD
const MAPA_FONTES: Record<string, string> = {
  'OpenSans': 'Open Sans:style=Bold',
  'Bebas': 'Bebas Neue:style=Regular',
  'Eindhoven': 'Eindhoven:style=Regular',
  'BADABB': 'Badaboom BB:style=Regular',
  'Playfair': 'Playfair Display:style=Bold'
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { produto, valores } = body;

    // 1. Configuração de pastas
    const outputDir = path.join(process.cwd(), 'public/renders');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const outputName = `render_${Date.now()}.stl`;
    const outputPath = path.join(outputDir, outputName);
    
    // Escolhe o template com base no produto (ex: 'generator.scad' ou 'caixa.scad')
    const templateName = produto?.template_name || 'generator.scad';
    const scadPath = path.join(process.cwd(), 'scad_templates', templateName);

    // 2. Preparar a fonte
    const fonteScad = MAPA_FONTES[valores.fonte] || 'Liberation Sans:style=Bold';

    // 3. Montar os argumentos do OpenSCAD
    // Enviamos tudo. O ficheiro .scad usará apenas o que tiver definido como variável.
    const args = [
      `-D "nome=\"${valores.nome_pet || ""}\""`,
      `-D "telefone=\"${valores.telefone || ""}\""`,
      `-D "fonte=\"${fonteScad}\""`,
      `-D "fontSize=${valores.fontSize || 7}"`,
      `-D "xPos=${valores.xPos || 0}"`,
      `-D "yPos=${valores.yPos || 0}"`,
      `-D "fontSizeN=${valores.fontSizeN || 6.5}"`,
      `-D "xPosN=${valores.xPosN || 0}"`,
      `-D "yPosN=${valores.yPosN || 0}"`,
      `-D "z_superficie=${produto?.z_surface || 3.0}"`,
      // Parâmetros para Caixas (mapeados dos sliders de posição)
      `-D "largura=${valores.xPos || 50}"`,
      `-D "profundidade=${valores.yPos || 30}"`,
      `-D "altura=${valores.fontSize || 20}"`
    ];

    const comando = `openscad -o "${outputPath}" ${args.join(' ')} "${scadPath}"`;

    console.log('--- A GERAR RENDER ---');
    console.log(comando);

    // 4. Executar OpenSCAD
    await execPromise(comando);

    return NextResponse.json({ 
      success: true, 
      url: `/renders/${outputName}` 
    });

  } catch (error: any) {
    console.error('ERRO NO RENDER:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}