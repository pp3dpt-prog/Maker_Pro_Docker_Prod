// @ts-nocheck
import { exec } from 'child_process';
import { promisify } from 'util';
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const execPromise = promisify(exec);

export async function POST(req: Request) {
  try {
    const { produto, valores } = await req.json();

    const outputDir = path.join(process.cwd(), 'public', 'renders');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const outputName = `render_${Date.now()}.stl`;
    const outputPath = path.join(outputDir, outputName);
    const scadPath = path.join(process.cwd(), produto?.template_name || 'generator.scad');

    // IGUAL AO TEU PROJETO ANTIGO: Montagem de argumentos rigorosa
    const args = [
      `-D "nome=\\"${valores.nome_pet || ""}\\""`,
      `-D "telefone=\\"${valores.telefone || ""}\\""`,
      `-D "fontSize=${valores.fontSize}"`,
      `-D "xPos=${valores.xPos}"`,
      `-D "yPos=${valores.yPos}"`,
      `-D "fontSizeN=${valores.fontSizeN}"`,
      `-D "xPosN=${valores.xPosN}"`,
      `-D "yPosN=${valores.yPosN}"`,
      `-D "z_superficie=${produto?.z_surface || 3.0}"`
    ];

    const comando = `openscad -o "${outputPath}" ${args.join(' ')} "${scadPath}"`;
    
    // Execução
    await execPromise(comando);

    // Retorno com Headers de CORS para a Vercel não bloquear
    return NextResponse.json(
      { success: true, url: `/renders/${outputName}` },
      { 
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    );

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Handler para o pre-flight do browser (OPTIONS)
export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}