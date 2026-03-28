// @ts-nocheck
import { exec } from 'child_process';
import { promisify } from 'util';
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const execPromise = promisify(exec);

// Tipagem para evitar erros de "any"
interface RenderRequest {
  produto: {
    template_name?: string;
    z_surface?: number;
  };
  valores: {
    fonte: string;
    nome_pet?: string;
    telefone?: string;
    fontSize: number;
    xPos: number;
    yPos: number;
    fontSizeN: number;
    xPosN: number;
    yPosN: number;
  };
}

const MAPA_FONTES: Record<string, string> = {
  'OpenSans': 'Open Sans:style=Bold',
  'Bebas': 'Bebas Neue:style=Regular',
  'Eindhoven': 'Eindhoven:style=Regular',
  'BADABB': 'Badaboom BB:style=Regular',
  'Playfair': 'Playfair Display:style=Bold'
};

export async function POST(req: Request) {
  try {
    const body: RenderRequest = await req.json();
    const { produto, valores } = body;

    const outputDir = path.join(process.cwd(), 'public', 'renders');
    
    // Cria a pasta se não existir para evitar erro de "no such file or directory"
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputName = `render_${Date.now()}.stl`;
    const outputPath = path.join(outputDir, outputName);
    
    // Caminho do template na raiz do Docker
    const templateName = produto?.template_name || 'generator.scad';
    const scadPath = path.join(process.cwd(), templateName);

    const fonteScad = MAPA_FONTES[valores.fonte] || 'Liberation Sans:style=Bold';

    // Argumentos formatados para evitar erros de escape no shell
    const args = [
      `-D "nome=\\"${valores.nome_pet || ""}\\""`,
      `-D "telefone=\\"${valores.telefone || ""}\\""`,
      `-D "fonte=\\"${fonteScad}\\""`,
      `-D "fontSize=${valores.fontSize}"`,
      `-D "xPos=${valores.xPos}"`,
      `-D "yPos=${valores.yPos}"`,
      `-D "fontSizeN=${valores.fontSizeN}"`,
      `-D "xPosN=${valores.xPosN}"`,
      `-D "yPosN=${valores.yPosN}"`,
      `-D "z_superficie=${produto?.z_surface || 3.0}"`
    ];

    const comando = `openscad -o "${outputPath}" ${args.join(' ')} "${scadPath}"`;

    console.log('Comando a ser executado:', comando);

    // Executa o OpenSCAD
    await execPromise(comando);

    // Retorna o link relativo que o Next.js consegue servir da pasta public
    return NextResponse.json({ 
      success: true, 
      url: `/renders/${outputName}` 
    });

  } catch (error: any) {
    console.error('Erro detalhado no Render:', error);
    return NextResponse.json(
      { error: 'Erro interno no servidor de renderização', details: error.message }, 
      { status: 500 }
    );
  }
}