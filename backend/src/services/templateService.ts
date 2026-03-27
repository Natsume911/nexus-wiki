import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';

export async function getTemplates(spaceId?: string) {
  const where: Prisma.TemplateWhereInput = spaceId
    ? { OR: [{ spaceId: null }, { spaceId }] }
    : {};

  return prisma.template.findMany({
    where,
    include: {
      createdBy: { select: { id: true, name: true, email: true, avatar: true } },
    },
    orderBy: [{ category: 'asc' }, { title: 'asc' }],
  });
}

export async function getTemplate(id: string) {
  return prisma.template.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true, avatar: true } },
    },
  });
}

export async function createTemplate(data: {
  title: string;
  description?: string;
  icon?: string;
  content: unknown;
  category?: string;
  spaceId?: string;
}, userId: string) {
  return prisma.template.create({
    data: {
      title: data.title,
      description: data.description,
      icon: data.icon,
      content: (data.content ?? { type: 'doc', content: [] }) as object,
      category: data.category || 'custom',
      spaceId: data.spaceId,
      createdById: userId,
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true, avatar: true } },
    },
  });
}

export async function updateTemplate(id: string, data: {
  title?: string;
  description?: string;
  icon?: string;
  content?: unknown;
  category?: string;
}) {
  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.icon !== undefined) updateData.icon = data.icon;
  if (data.content !== undefined) updateData.content = data.content as object;
  if (data.category !== undefined) updateData.category = data.category;

  return prisma.template.update({
    where: { id },
    data: updateData,
    include: {
      createdBy: { select: { id: true, name: true, email: true, avatar: true } },
    },
  });
}

export async function deleteTemplate(id: string) {
  return prisma.template.delete({ where: { id } });
}

export async function seedBuiltInTemplates(userId: string) {
  const builtInTemplates = [
    {
      title: 'Note di Riunione',
      description: 'Template per appunti di riunione con agenda, partecipanti e azioni',
      icon: '📋',
      category: 'built-in',
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Note di Riunione' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Informazioni' }],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Data: ' }, { type: 'text', text: 'GG/MM/AAAA' }] }],
              },
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Ora: ' }, { type: 'text', text: 'HH:MM' }] }],
              },
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Luogo: ' }, { type: 'text', text: 'Sala / Link' }] }],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Partecipanti' }],
          },
          {
            type: 'bulletList',
            content: [
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nome Cognome' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nome Cognome' }] }] },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Agenda' }],
          },
          {
            type: 'orderedList',
            content: [
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Punto 1' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Punto 2' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Punto 3' }] }] },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Note' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Scrivi qui gli appunti della riunione...' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Azioni da Intraprendere' }],
          },
          {
            type: 'taskList',
            content: [
              { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Azione 1 — Responsabile — Scadenza' }] }] },
              { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Azione 2 — Responsabile — Scadenza' }] }] },
            ],
          },
        ],
      },
    },
    {
      title: 'Registro Decisioni',
      description: 'Template per documentare decisioni importanti con contesto e motivazioni',
      icon: '⚖️',
      category: 'built-in',
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Registro Decisioni' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Decisione' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Descrivi brevemente la decisione presa.' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Stato' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Proposta' }, { type: 'text', text: ' | Approvata | Rifiutata | Deprecata' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Contesto' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Qual è il contesto o il problema che ha portato a questa decisione?' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Opzioni Considerate' }],
          },
          {
            type: 'orderedList',
            content: [
              {
                type: 'listItem',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Opzione A: ' }, { type: 'text', text: 'Descrizione' }] },
                  { type: 'bulletList', content: [
                    { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Pro: ...' }] }] },
                    { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Contro: ...' }] }] },
                  ]},
                ],
              },
              {
                type: 'listItem',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Opzione B: ' }, { type: 'text', text: 'Descrizione' }] },
                  { type: 'bulletList', content: [
                    { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Pro: ...' }] }] },
                    { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Contro: ...' }] }] },
                  ]},
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Esito' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Quale opzione è stata scelta e perché?' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Conseguenze' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Quali sono le implicazioni e i prossimi passi?' }],
          },
        ],
      },
    },
    {
      title: 'Runbook Operativo',
      description: 'Template per procedure operative passo-passo con troubleshooting',
      icon: '🔧',
      category: 'built-in',
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Runbook Operativo' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Panoramica' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Descrizione breve di cosa fa questa procedura e quando va eseguita.' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Prerequisiti' }],
          },
          {
            type: 'bulletList',
            content: [
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Accesso a ...' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Credenziali per ...' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Strumenti installati: ...' }] }] },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Procedura' }],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Step 1 — Preparazione' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Descrivi il primo passo...' }],
          },
          {
            type: 'codeBlock',
            attrs: { language: 'bash' },
            content: [{ type: 'text', text: '# Comando di esempio\necho "Hello World"' }],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Step 2 — Esecuzione' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Descrivi il secondo passo...' }],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Step 3 — Verifica' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Come verificare che la procedura sia andata a buon fine.' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Troubleshooting' }],
          },
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Problema' }] }] },
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Causa Probabile' }] }] },
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Soluzione' }] }] },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Errore X' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Causa Y' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Soluzione Z' }] }] },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Contatti' }],
          },
          {
            type: 'bulletList',
            content: [
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Owner: ' }, { type: 'text', text: 'Nome — email@example.com' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Escalation: ' }, { type: 'text', text: 'Nome — email@example.com' }] }] },
            ],
          },
        ],
      },
    },
    {
      title: 'Report Incidente',
      description: 'Template per documentare incidenti con timeline, impatto e root cause analysis',
      icon: '🚨',
      category: 'built-in',
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Report Incidente' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Riepilogo' }],
          },
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Campo' }] }] },
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Valore' }] }] },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Severity' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'SEV1 / SEV2 / SEV3 / SEV4' }] }] },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Data Inizio' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'GG/MM/AAAA HH:MM' }] }] },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Data Risoluzione' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'GG/MM/AAAA HH:MM' }] }] },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Durata' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'X ore Y minuti' }] }] },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Responsabile' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nome Cognome' }] }] },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Timeline' }],
          },
          {
            type: 'bulletList',
            content: [
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'HH:MM' }, { type: 'text', text: ' — Rilevamento iniziale del problema' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'HH:MM' }, { type: 'text', text: ' — Escalation al team' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'HH:MM' }, { type: 'text', text: ' — Identificata la causa' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'HH:MM' }, { type: 'text', text: ' — Fix applicato' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'HH:MM' }, { type: 'text', text: ' — Servizio ripristinato' }] }] },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Impatto' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Descrivi l\'impatto su utenti, servizi e business.' }],
          },
          {
            type: 'bulletList',
            content: [
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Utenti coinvolti: ' }, { type: 'text', text: 'N' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Servizi coinvolti: ' }, { type: 'text', text: '...' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Impatto economico: ' }, { type: 'text', text: '...' }] }] },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Root Cause Analysis' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Qual è stata la causa principale dell\'incidente?' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Remediation' }],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Azioni Immediate' }],
          },
          {
            type: 'taskList',
            content: [
              { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Azione correttiva 1' }] }] },
              { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Azione correttiva 2' }] }] },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Azioni Preventive' }],
          },
          {
            type: 'taskList',
            content: [
              { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Miglioramento monitoring' }] }] },
              { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Aggiornamento documentazione' }] }] },
            ],
          },
        ],
      },
    },
    {
      title: 'Guida How-To',
      description: 'Template per guide pratiche passo-passo',
      icon: '📖',
      category: 'built-in',
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Guida How-To' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Panoramica' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Descrivi brevemente cosa si impara seguendo questa guida e a chi è rivolta.' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Requisiti' }],
          },
          {
            type: 'bulletList',
            content: [
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Conoscenza di ...' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Software installato: ...' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Tempo stimato: X minuti' }] }] },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Procedura' }],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: '1. Primo Passo' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Descrivi il primo passo con dettagli sufficienti.' }],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: '2. Secondo Passo' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Descrivi il secondo passo...' }],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: '3. Terzo Passo' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Descrivi il terzo passo...' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Risultato Atteso' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Cosa dovresti vedere/ottenere alla fine della procedura.' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Suggerimenti e Note' }],
          },
          {
            type: 'bulletList',
            content: [
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Suggerimento 1' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Suggerimento 2' }] }] },
            ],
          },
        ],
      },
    },
    {
      title: 'Documentazione API',
      description: 'Template per documentare endpoint API con parametri, richieste e risposte',
      icon: '🔌',
      category: 'built-in',
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Documentazione API' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Endpoint' }],
          },
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Campo' }] }] },
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Valore' }] }] },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'URL' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'code' }], text: '/api/v1/resource' }] }] },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Metodo' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'code' }], text: 'GET / POST / PUT / DELETE' }] }] },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Autenticazione' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bearer Token / API Key' }] }] },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Parametri' }],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Path Parameters' }],
          },
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nome' }] }] },
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Tipo' }] }] },
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Obbligatorio' }] }] },
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Descrizione' }] }] },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'code' }], text: 'id' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'string' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Si' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ID della risorsa' }] }] },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Query Parameters' }],
          },
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nome' }] }] },
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Tipo' }] }] },
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Default' }] }] },
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Descrizione' }] }] },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'code' }], text: 'page' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'number' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '1' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Numero della pagina' }] }] },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Richiesta (Request Body)' }],
          },
          {
            type: 'codeBlock',
            attrs: { language: 'json' },
            content: [{ type: 'text', text: '{\n  "field1": "valore",\n  "field2": 123\n}' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Risposta (Response)' }],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: '200 OK' }],
          },
          {
            type: 'codeBlock',
            attrs: { language: 'json' },
            content: [{ type: 'text', text: '{\n  "data": {\n    "id": "abc123",\n    "field1": "valore",\n    "createdAt": "2024-01-15T10:30:00Z"\n  }\n}' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Errori' }],
          },
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Codice' }] }] },
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Descrizione' }] }] },
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Esempio' }] }] },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '400' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Richiesta non valida' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'code' }], text: '{ "error": "Campo obbligatorio mancante" }' }] }] },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '404' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Risorsa non trovata' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'code' }], text: '{ "error": "Risorsa non trovata" }' }] }] },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Esempio con cURL' }],
          },
          {
            type: 'codeBlock',
            attrs: { language: 'bash' },
            content: [{ type: 'text', text: 'curl -X GET "https://api.example.com/api/v1/resource" \\\n  -H "Authorization: Bearer YOUR_TOKEN" \\\n  -H "Content-Type: application/json"' }],
          },
        ],
      },
    },
    // ── New templates ──
    {
      title: 'Retrospettiva',
      description: 'Template per retrospettive di sprint/progetto con cosa è andato bene, da migliorare e azioni',
      icon: '🔄',
      category: 'built-in',
      content: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Retrospettiva' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '✅ Cosa è andato bene' }] },
          { type: 'bulletList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Punto positivo 1' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Punto positivo 2' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Punto positivo 3' }] }] },
          ]},
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '🔧 Da migliorare' }] },
          { type: 'bulletList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Area di miglioramento 1' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Area di miglioramento 2' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Area di miglioramento 3' }] }] },
          ]},
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '🎯 Azioni' }] },
          { type: 'taskList', content: [
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Azione 1 — Responsabile — Scadenza' }] }] },
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Azione 2 — Responsabile — Scadenza' }] }] },
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Azione 3 — Responsabile — Scadenza' }] }] },
          ]},
        ],
      },
    },
    {
      title: 'Piano di Progetto',
      description: 'Template per la pianificazione di un progetto con obiettivi, timeline, risorse e rischi',
      icon: '📅',
      category: 'built-in',
      content: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Piano di Progetto' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Obiettivo' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Descrivi l\'obiettivo principale del progetto e i risultati attesi.' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Timeline' }] },
          { type: 'table', content: [
            { type: 'tableRow', content: [
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Fase' }] }] },
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Inizio' }] }] },
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Fine' }] }] },
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Responsabile' }] }] },
            ]},
            { type: 'tableRow', content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Fase 1 — Analisi' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'GG/MM' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'GG/MM' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nome' }] }] },
            ]},
            { type: 'tableRow', content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Fase 2 — Sviluppo' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'GG/MM' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'GG/MM' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nome' }] }] },
            ]},
            { type: 'tableRow', content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Fase 3 — Test & Deploy' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'GG/MM' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'GG/MM' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nome' }] }] },
            ]},
          ]},
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Risorse' }] },
          { type: 'bulletList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Team: ' }, { type: 'text', text: 'Elenco membri del team' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Budget: ' }, { type: 'text', text: 'Importo stimato' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Strumenti: ' }, { type: 'text', text: 'Software, infrastruttura, licenze' }] }] },
          ]},
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Rischi' }] },
          { type: 'bulletList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rischio 1 — Mitigazione: ...' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rischio 2 — Mitigazione: ...' }] }] },
          ]},
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Milestone' }] },
          { type: 'taskList', content: [
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Milestone 1 — Descrizione — Data' }] }] },
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Milestone 2 — Descrizione — Data' }] }] },
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Milestone 3 — Descrizione — Data' }] }] },
          ]},
        ],
      },
    },
    {
      title: 'Changelog / Release Notes',
      description: 'Template per documentare le release con categorie Added, Changed, Fixed',
      icon: '📦',
      category: 'built-in',
      content: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Changelog' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'v1.0.0 — GG/MM/AAAA' }] },
          { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: '🆕 Added' }] },
          { type: 'bulletList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nuova funzionalità X' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nuova funzionalità Y' }] }] },
          ]},
          { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: '🔄 Changed' }] },
          { type: 'bulletList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Miglioramento a componente Z' }] }] },
          ]},
          { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: '🐛 Fixed' }] },
          { type: 'bulletList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bug fix per problema W' }] }] },
          ]},
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'v0.9.0 — GG/MM/AAAA' }] },
          { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: '🆕 Added' }] },
          { type: 'bulletList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Funzionalità iniziale' }] }] },
          ]},
        ],
      },
    },
    {
      title: 'Post-Mortem',
      description: 'Template per analisi post-mortem con 5 Whys, lessons learned e azioni',
      icon: '🔍',
      category: 'built-in',
      content: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Post-Mortem' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Riepilogo' }] },
          { type: 'table', content: [
            { type: 'tableRow', content: [
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Campo' }] }] },
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Valore' }] }] },
            ]},
            { type: 'tableRow', content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Incidente' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Breve descrizione' }] }] },
            ]},
            { type: 'tableRow', content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Data' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'GG/MM/AAAA' }] }] },
            ]},
            { type: 'tableRow', content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Impatto' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Alto / Medio / Basso' }] }] },
            ]},
            { type: 'tableRow', content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Durata' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'X ore Y minuti' }] }] },
            ]},
          ]},
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '5 Whys — Analisi Causa Radice' }] },
          { type: 'orderedList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Perché? ' }, { type: 'text', text: 'Risposta al primo perché...' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Perché? ' }, { type: 'text', text: 'Risposta al secondo perché...' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Perché? ' }, { type: 'text', text: 'Risposta al terzo perché...' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Perché? ' }, { type: 'text', text: 'Risposta al quarto perché...' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Perché? ' }, { type: 'text', text: 'CAUSA RADICE' }] }] },
          ]},
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Lessons Learned' }] },
          { type: 'bulletList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Lezione 1' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Lezione 2' }] }] },
          ]},
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Azioni Correttive' }] },
          { type: 'taskList', content: [
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Azione 1 — Responsabile — Scadenza' }] }] },
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Azione 2 — Responsabile — Scadenza' }] }] },
          ]},
        ],
      },
    },
    {
      title: 'Onboarding Nuovo Membro',
      description: 'Template per l\'onboarding di nuovi membri del team con checklist per ogni fase',
      icon: '👋',
      category: 'built-in',
      content: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Onboarding Nuovo Membro' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Benvenuto nel team! Questa guida ti aiuterà a orientarti nei primi giorni.' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '📋 Primo Giorno' }] },
          { type: 'taskList', content: [
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Configurare account email e strumenti aziendali' }] }] },
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Accesso a VPN, repository e ambienti' }] }] },
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Incontro con il team e presentazioni' }] }] },
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Leggere documentazione di progetto' }] }] },
          ]},
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '📋 Prima Settimana' }] },
          { type: 'taskList', content: [
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Setup ambiente di sviluppo locale' }] }] },
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Completare primo task di onboarding' }] }] },
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Partecipare alle cerimonie del team (standup, planning)' }] }] },
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Familiarizzare con il flusso CI/CD' }] }] },
          ]},
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '📋 Primo Mese' }] },
          { type: 'taskList', content: [
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Completare prima feature autonomamente' }] }] },
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Fare code review su PR dei colleghi' }] }] },
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sessione feedback 1:1 con il manager' }] }] },
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Identificare aree di interesse/specializzazione' }] }] },
          ]},
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Contatti Utili' }] },
          { type: 'bulletList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Manager: ' }, { type: 'text', text: 'Nome — email' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Buddy: ' }, { type: 'text', text: 'Nome — email' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'IT Support: ' }, { type: 'text', text: 'canale/email' }] }] },
          ]},
        ],
      },
    },
    {
      title: '1:1 Meeting',
      description: 'Template per incontri 1:1 con argomenti, feedback e azioni',
      icon: '🤝',
      category: 'built-in',
      content: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '1:1 Meeting' }] },
          { type: 'bulletList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Data: ' }, { type: 'text', text: 'GG/MM/AAAA' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Partecipanti: ' }, { type: 'text', text: 'Nome 1, Nome 2' }] }] },
          ]},
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Argomenti' }] },
          { type: 'orderedList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Stato dei task correnti' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Blocchi o difficoltà' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Obiettivi prossima settimana' }] }] },
          ]},
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Feedback' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Note e feedback scambiati durante l\'incontro.' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Azioni' }] },
          { type: 'taskList', content: [
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Azione 1 — Responsabile — Scadenza' }] }] },
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Azione 2 — Responsabile — Scadenza' }] }] },
          ]},
        ],
      },
    },
    {
      title: 'Matrice RACI',
      description: 'Template per definire responsabilità con matrice Responsible, Accountable, Consulted, Informed',
      icon: '📊',
      category: 'built-in',
      content: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Matrice RACI' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Definisci chi è Responsabile (R), Accountable (A), Consultato (C) e Informato (I) per ogni attività.' }] },
          { type: 'table', content: [
            { type: 'tableRow', content: [
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Attività' }] }] },
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Responsible' }] }] },
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Accountable' }] }] },
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Consulted' }] }] },
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Informed' }] }] },
            ]},
            { type: 'tableRow', content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Attività 1' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nome' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nome' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nome' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nome' }] }] },
            ]},
            { type: 'tableRow', content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Attività 2' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nome' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nome' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nome' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nome' }] }] },
            ]},
            { type: 'tableRow', content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Attività 3' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nome' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nome' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nome' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nome' }] }] },
            ]},
          ]},
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Legenda' }] },
          { type: 'bulletList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'R — Responsible: ' }, { type: 'text', text: 'Chi esegue il lavoro' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'A — Accountable: ' }, { type: 'text', text: 'Chi ha la responsabilità finale' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'C — Consulted: ' }, { type: 'text', text: 'Chi fornisce input prima della decisione' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'I — Informed: ' }, { type: 'text', text: 'Chi viene informato dopo la decisione' }] }] },
          ]},
        ],
      },
    },
    {
      title: 'OKR / Obiettivi',
      description: 'Template per Objectives and Key Results con tracciamento progress',
      icon: '🎯',
      category: 'built-in',
      content: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'OKR — Obiettivi e Risultati Chiave' }] },
          { type: 'bulletList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Periodo: ' }, { type: 'text', text: 'Q1 2026' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Owner: ' }, { type: 'text', text: 'Nome Team / Persona' }] }] },
          ]},
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Objective 1: Titolo Obiettivo' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Descrizione qualitativa dell\'obiettivo.' }] },
          { type: 'taskList', content: [
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'KR 1.1 — Metrica misurabile — Target: X' }] }] },
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'KR 1.2 — Metrica misurabile — Target: Y' }] }] },
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'KR 1.3 — Metrica misurabile — Target: Z' }] }] },
          ]},
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Objective 2: Titolo Obiettivo' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Descrizione qualitativa dell\'obiettivo.' }] },
          { type: 'taskList', content: [
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'KR 2.1 — Metrica misurabile — Target: X' }] }] },
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'KR 2.2 — Metrica misurabile — Target: Y' }] }] },
          ]},
        ],
      },
    },
    {
      title: 'Analisi dei Rischi',
      description: 'Template per identificare, valutare e mitigare i rischi di un progetto',
      icon: '⚠️',
      category: 'built-in',
      content: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Analisi dei Rischi' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Contesto' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Descrivi il progetto o il sistema per cui stai valutando i rischi.' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Matrice dei Rischi' }] },
          { type: 'table', content: [
            { type: 'tableRow', content: [
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rischio' }] }] },
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Probabilità' }] }] },
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Impatto' }] }] },
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Priorità' }] }] },
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Mitigazione' }] }] },
            ]},
            { type: 'tableRow', content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rischio 1' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Alta' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Alto' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '🔴 Critico' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Piano di mitigazione...' }] }] },
            ]},
            { type: 'tableRow', content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rischio 2' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Media' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Medio' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '🟡 Medio' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Piano di mitigazione...' }] }] },
            ]},
            { type: 'tableRow', content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rischio 3' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bassa' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Basso' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '🟢 Basso' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Monitoraggio periodico' }] }] },
            ]},
          ]},
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Piano di Risposta' }] },
          { type: 'taskList', content: [
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Definire responsabile per ogni rischio critico' }] }] },
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Pianificare revisione rischi mensile' }] }] },
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Preparare piano di contingenza per rischi critici' }] }] },
          ]},
        ],
      },
    },
    {
      title: 'Troubleshooting Guide',
      description: 'Template per guide di diagnostica e risoluzione problemi',
      icon: '🛠️',
      category: 'built-in',
      content: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Troubleshooting Guide' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Sintomo' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Descrivi il problema o l\'errore osservato dall\'utente.' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Diagnostica' }] },
          { type: 'orderedList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Verificare lo stato del servizio' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Controllare i log per errori recenti' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Verificare connettività di rete' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Controllare risorse (CPU, RAM, disco)' }] }] },
          ]},
          { type: 'codeBlock', attrs: { language: 'bash' }, content: [{ type: 'text', text: '# Comandi utili per la diagnostica\nsystemctl status nome-servizio\njournalctl -u nome-servizio --since "1 hour ago"\ndf -h && free -m' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Soluzione 1 — Riavvio del servizio' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Se il servizio è bloccato o non risponde:' }] },
          { type: 'codeBlock', attrs: { language: 'bash' }, content: [{ type: 'text', text: 'sudo systemctl restart nome-servizio\nsudo systemctl status nome-servizio' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Soluzione 2 — Pulizia cache/dati temporanei' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Se il problema è legato a dati corrotti o cache obsoleta:' }] },
          { type: 'codeBlock', attrs: { language: 'bash' }, content: [{ type: 'text', text: '# Pulire la cache\nrm -rf /tmp/nome-servizio-cache/*\nsudo systemctl restart nome-servizio' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Escalation' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Se nessuna soluzione funziona, escalare al team di competenza con:' }] },
          { type: 'bulletList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Screenshot/log dell\'errore' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Passi già tentati' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Timestamp dell\'occorrenza' }] }] },
          ]},
        ],
      },
    },
  ];

  // Create only templates that don't exist yet (check by title + category)
  const existingTitles = new Set(
    (await prisma.template.findMany({
      where: { category: 'built-in' },
      select: { title: true },
    })).map(t => t.title)
  );

  const toCreate = builtInTemplates.filter(t => !existingTitles.has(t.title));

  if (toCreate.length === 0) {
    return { seeded: false, message: 'Tutti i template predefiniti esistono già' };
  }

  const created = await prisma.$transaction(
    toCreate.map(t =>
      prisma.template.create({
        data: {
          title: t.title,
          description: t.description,
          icon: t.icon,
          content: t.content as object,
          category: t.category,
          createdById: userId,
        },
      })
    )
  );

  return { seeded: true, count: created.length };
}
