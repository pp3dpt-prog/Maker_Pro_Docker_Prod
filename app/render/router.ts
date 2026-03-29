// @ts-nocheck
import { exec } from 'child_process';
import { promisify } from 'util';
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const execPromise = promisify(exec);

// ISTO RESOLVE O ERRO DE MATCHING: Aceita qualquer origem
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { produto, valores } = body;

    const outputDir = path.join(process.cwd(), 'public', 'renders');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const outputName = `render_${Date.now()}.stl`;
    const outputPath = path.join(outputDir, outputName);
    const scadPath = path.join(process.cwd(), 'generator.scad');

    const args = [
      `-D "nome=\\"${valores.nome_pet || ""}\\""`,
      `-D "telefone=\\"${valores.telefone || ""}\\""`,
      `-D "fontSize=${valores.fontSize}"`,
      `-D "xPos=${valores.xPos}"`,
      `-D "yPos=${valores.yPos}"`,
      `-D "fontSizeN=${valores.fontSizeN}"`,
      `-D "xPosN=${valores.xPosN}"`,
      `-D "yPosN=${valores.yPosN}"`
    ];

    const comando = `openscad -o "${outputPath}" ${args.join(' ')} "${scadPath}"`;
    await execPromise(comando);

    return NextResponse.json(
      { success: true, url: `/renders/${outputName}` },
      { headers: corsHeaders }
    );

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}