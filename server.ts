import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import { GoogleGenAI, Type } from "@google/genai";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from "docx";
import multer from "multer";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface User {
  id: number;
  email?: string;
  telefone?: string;
  password?: string;
  data_ativacao?: string;
  data_expiracao?: string;
  plano_tipo?: string;
  limite_planos?: number;
  planos_consumidos: number;
  status: string;
  is_admin: number;
  escola?: string;
  professor_nome?: string;
}

async function startServer() {
  try {
    dotenv.config();
    console.log("Starting server initialization...");
  // Use a simple path for the database in the project root
  let dbPath = 'ppa.db';
  if (process.env.NODE_ENV === 'production') {
    // In production, keep it simple in the root
    dbPath = path.join(process.cwd(), 'ppa.db');
  }

  const db = new Database(dbPath);
    console.log("Database connected.");

  // Initialize Database
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      telefone TEXT UNIQUE,
      password TEXT,
      data_ativacao TEXT,
      data_expiracao TEXT,
      plano_tipo TEXT,
      limite_planos INTEGER,
      planos_consumidos INTEGER DEFAULT 0,
      status TEXT DEFAULT 'Ativo',
      is_admin INTEGER DEFAULT 0,
      escola TEXT,
      professor_nome TEXT,
      provincia TEXT,
      municipio TEXT,
      numero_agente TEXT,
      biografia TEXT,
      especializacoes TEXT,
      foto_url TEXT
    );

    CREATE TABLE IF NOT EXISTS plans_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      content TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS curriculum (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      classe TEXT,
      disciplina TEXT,
      tema TEXT,
      subtema TEXT,
      sumarios TEXT -- JSON array
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT,
      classe TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      title TEXT,
      start_date TEXT,
      end_date TEXT,
      plan_id INTEGER,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(plan_id) REFERENCES plans_history(id)
    );

    CREATE TABLE IF NOT EXISTS questions_bank (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      subject TEXT,
      classe TEXT,
      content TEXT, -- JSON array of questions
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS news (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      content TEXT,
      category TEXT,
      source TEXT DEFAULT 'Portal Pedagógico Angola',
      is_ai_generated INTEGER DEFAULT 0,
      date TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      content TEXT,
      type TEXT, -- 'opinião', 'crítica', 'reclamação'
      status TEXT DEFAULT 'Pendente',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS community_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      plan_id INTEGER,
      title TEXT,
      subject TEXT,
      classe TEXT,
      content TEXT,
      status TEXT DEFAULT 'Pendente',
      likes INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(plan_id) REFERENCES plans_history(id)
    );
  `);
  console.log("Database tables initialized.");

  // Migrations for existing database
  try { db.exec("ALTER TABLE news ADD COLUMN source TEXT DEFAULT 'Portal Pedagógico Angola'"); } catch(e) {}
  try { db.exec("ALTER TABLE news ADD COLUMN is_ai_generated INTEGER DEFAULT 0"); } catch(e) {}
  try { db.exec("ALTER TABLE news ADD COLUMN expires_at TEXT"); } catch(e) {}

  // Initialize curriculum if empty
  const curriculumCount = db.prepare("SELECT COUNT(*) as count FROM curriculum").get() as { count: number };
  if (curriculumCount.count === 0) {
    console.log("Initializing curriculum from static file...");
    try {
      const { curriculo } = await import('./src/curriculo.ts');
      const insert = db.prepare("INSERT INTO curriculum (classe, disciplina, tema, subtema, sumarios) VALUES (?, ?, ?, ?, ?)");
      
      for (const [classe, disciplinas] of Object.entries(curriculo)) {
        for (const [disciplina, temas] of Object.entries(disciplinas as any)) {
          for (const [tema, subtemas] of Object.entries(temas as any)) {
            for (const [subtema, sumarios] of Object.entries(subtemas as any)) {
              insert.run(classe, disciplina, tema, subtema, JSON.stringify(sumarios));
            }
          }
        }
      }
      console.log("Curriculum initialized.");
    } catch (e) {
      console.error("Error initializing curriculum:", e);
    }
  }

  // Migrations for existing database
  try { db.exec("ALTER TABLE users ADD COLUMN numero_agente TEXT"); } catch(e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN biografia TEXT"); } catch(e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN especializacoes TEXT"); } catch(e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN foto_url TEXT"); } catch(e) {}

  // Seed news if empty
  const newsCount = db.prepare("SELECT COUNT(*) as count FROM news").get() as any;
  if (newsCount.count === 0) {
    const insertNews = db.prepare("INSERT INTO news (title, content, category, date) VALUES (?, ?, ?, ?)");
    insertNews.run("Novo Calendário Escolar 2026", "O MED anunciou as novas datas para o ano lectivo de 2026. Confira na biblioteca.", "MED", new Date().toISOString());
    insertNews.run("Dica Pedagógica: Metodologias Ativas", "Como engajar alunos do ensino primário usando jogos educativos.", "Pedagogia", new Date().toISOString());
    insertNews.run("Atualização do Portal PPA", "Novas funcionalidades de estatísticas e perfil detalhado adicionadas.", "Aviso", new Date().toISOString());
  }
  try {
    const tableInfo = db.prepare("PRAGMA table_info(users)").all() as any[];
    const columns = tableInfo.map(c => c.name);

    if (!columns.includes('telefone')) {
      db.exec("ALTER TABLE users ADD COLUMN telefone TEXT UNIQUE");
      console.log("Migration: Added telefone column.");
    }
    if (!columns.includes('escola')) {
      db.exec("ALTER TABLE users ADD COLUMN escola TEXT");
      console.log("Migration: Added escola column.");
    }
    if (!columns.includes('professor_nome')) {
      db.exec("ALTER TABLE users ADD COLUMN professor_nome TEXT");
      console.log("Migration: Added professor_nome column.");
    }
  } catch (e) {
    console.error("Migration error:", e);
  }

  // Create admin if not exists
  const adminEmail = "arybastodasilva07@gmail.com";
  const adminPass = "Ab005345RM";
  const adminExists = db.prepare("SELECT * FROM users WHERE email = ?").get(adminEmail);
  if (!adminExists) {
    db.prepare("INSERT INTO users (email, password, is_admin, status, professor_nome) VALUES (?, ?, ?, ?, ?)").run(
      adminEmail,
      adminPass,
      1,
      "Ativo",
      "Administrador"
    );
    console.log("Admin user created.");
  }

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  console.log(`Configuring server on port ${PORT}...`);

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Helper to get settings
  const getSettings = () => {
    const rows = db.prepare("SELECT * FROM settings").all() as { key: string, value: string }[];
    return rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {} as Record<string, string>);
  };

  // Helper to send admin notifications
  const sendAdminNotification = async (subject: string, text: string) => {
    const settings = getSettings();
    const smtpHost = settings['smtp_host'] || process.env.SMTP_HOST;
    const smtpPort = settings['smtp_port'] || process.env.SMTP_PORT || '587';
    const smtpSecure = settings['smtp_secure'] === 'true' || process.env.SMTP_SECURE === 'true';
    const smtpUser = settings['smtp_user'] || process.env.SMTP_USER;
    const smtpPass = settings['smtp_pass'] || process.env.SMTP_PASS;
    const adminEmail = settings['admin_email'] || process.env.ADMIN_EMAIL || smtpUser;

    if (!smtpUser || !smtpPass) {
      console.log("SMTP not configured, logging notification to console:");
      console.log(`Subject: ${subject}`);
      console.log(text);
      return;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort),
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
    });

    try {
      await transporter.sendMail({
        from: smtpUser,
        to: adminEmail,
        subject,
        text,
      });
    } catch (error) {
      console.error("Error sending admin notification:", error);
    }
  };

  // Cleanup old history (older than 30 days) and expired news
  const cleanupData = async () => {
    console.log("Running daily cleanup...");
    db.prepare("DELETE FROM plans_history WHERE created_at < datetime('now', '-30 days')").run();
    db.prepare("DELETE FROM news WHERE expires_at < datetime('now')").run();
  };
  setInterval(cleanupData, 24 * 60 * 60 * 1000); // Once a day
  cleanupData(); // Run on start

  // API Routes
  app.post("/api/ai/save-synced-news", (req, res) => {
    const { newsList } = req.body;
    if (!Array.isArray(newsList)) return res.status(400).json({ error: "Invalid news list" });

    try {
      const insert = db.prepare("INSERT INTO news (title, content, category, source, is_ai_generated, expires_at) VALUES (?, ?, ?, ?, 1, ?)");
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      
      let count = 0;
      for (const item of newsList) {
        const exists = db.prepare("SELECT id FROM news WHERE title = ?").get(item.title);
        if (!exists) {
          insert.run(item.title, item.content, item.category, item.source, expiresAt);
          count++;
        }
      }
      res.json({ success: true, count });
    } catch (error) {
      console.error("Error saving synced news:", error);
      res.status(500).json({ error: "Erro ao salvar notícias sincronizadas" });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const { identifier, password } = req.body; // identifier can be email or telefone
    const user = db.prepare("SELECT * FROM users WHERE (email = ? OR telefone = ?) AND password = ?").get(identifier, identifier, password) as User | undefined;
    
    if (user) {
      // Check expiration if not admin
      if (!user.is_admin && user.data_expiracao) {
        const now = new Date();
        const expiry = new Date(user.data_expiracao);
        if (now > expiry) {
          return res.status(403).json({ error: "Sua assinatura expirou. Por favor, renove seu plano." });
        }
      }
      res.json({ user });
    } else {
      res.status(401).json({ error: "Credenciais inválidas" });
    }
  });

  app.post("/api/auth/register", (req, res) => {
    const { email, telefone, password, escola, professor_nome, provincia, municipio, plano_tipo } = req.body;
    // Generate a random 6-digit password if none provided
    const finalPassword = password || Math.floor(100000 + Math.random() * 900000).toString();
    
    try {
      const result = db.prepare("INSERT INTO users (email, telefone, password, status, escola, professor_nome, provincia, municipio, plano_tipo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
        email || null,
        telefone || null,
        finalPassword,
        'Pendente',
        escola,
        professor_nome,
        provincia,
        municipio,
        plano_tipo || 'Bronze'
      );
      res.json({ id: result.lastInsertRowid, password: finalPassword });
    } catch (e) {
      res.status(400).json({ error: "E-mail ou Telefone já cadastrado" });
    }
  });

  app.post("/api/auth/request-email", async (req, res) => {
    const { email, telefone, professor_nome, escola, provincia, municipio, plano_tipo } = req.body;
    
    // Fetch SMTP settings from database
    const settingsRows = db.prepare("SELECT key, value FROM settings WHERE key IN ('smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass', 'admin_email')").all() as { key: string, value: string }[];
    const settings = settingsRows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {} as Record<string, string>);

    const smtpHost = settings['smtp_host'] || process.env.SMTP_HOST;
    const smtpPort = settings['smtp_port'] || process.env.SMTP_PORT || '587';
    const smtpSecure = settings['smtp_secure'] === 'true' || process.env.SMTP_SECURE === 'true';
    const smtpUser = settings['smtp_user'] || process.env.SMTP_USER;
    const smtpPass = settings['smtp_pass'] || process.env.SMTP_PASS;
    const adminEmail = settings['admin_email'] || process.env.ADMIN_EMAIL || smtpUser;

    // Configure transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort),
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const mailOptions = {
      from: smtpUser,
      to: adminEmail,
      subject: `Novo Pedido de Acesso: ${professor_nome}`,
      text: `
        Novo pedido de acesso ao Portal Pedagógico Angola:
        
        Nome: ${professor_nome}
        Escola: ${escola}
        Província: ${provincia}
        Município: ${municipio}
        Plano Escolhido: ${plano_tipo || 'Bronze'}
        
        Contacto:
        Email: ${email || 'N/A'}
        Telefone: ${telefone || 'N/A'}
        
        Por favor, revise o pedido no painel administrativo.
      `,
    };

    try {
      if (!smtpUser || !smtpPass) {
        console.log("SMTP not configured, logging email to console:");
        console.log(mailOptions.text);
        return res.json({ success: true, message: "Pedido registrado (Modo Simulação - SMTP não configurado)" });
      }
      await transporter.sendMail(mailOptions);
      res.json({ success: true });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Erro ao enviar e-mail. Verifique as configurações SMTP ou tente WhatsApp/SMS." });
    }
  });

  app.post("/api/auth/forgot-password", (req, res) => {
    const { identifier } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ? OR telefone = ?").get(identifier, identifier) as User | undefined;
    
    if (user) {
      // In a real app, send email/SMS. Here we just return success for simulation.
      // We generate a temporary password.
      const newPass = Math.random().toString(36).slice(-8);
      db.prepare("UPDATE users SET password = ? WHERE id = ?").run(newPass, user.id);
      res.json({ success: true, message: "Uma nova senha foi gerada. Entre em contato com o suporte para recebê-la.", tempPass: newPass });
    } else {
      res.status(404).json({ error: "Usuário não encontrado" });
    }
  });

  app.get("/api/plans/history/:userId", (req, res) => {
    const history = db.prepare("SELECT * FROM plans_history WHERE user_id = ? ORDER BY created_at DESC").all(req.params.userId);
    res.json(history);
  });

    app.post("/api/plans/save", (req, res) => {
    const { userId, content, metadata } = req.body;
    try {
      db.prepare("INSERT INTO plans_history (user_id, content, metadata) VALUES (?, ?, ?)").run(
        userId,
        content,
        metadata
      );
      res.json({ success: true });
    } catch (e) {
      console.error("Error saving plan history:", e);
      res.status(500).json({ error: "Não foi possível salvar o histórico do plano." });
    }
  });

  app.post("/api/users/update-credits", (req, res) => {
    const { userId } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as User | undefined;
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    try {
      if (!user.is_admin) {
        db.prepare("UPDATE users SET planos_consumidos = planos_consumidos + 1 WHERE id = ?").run(userId);
      }
      res.json({ success: true });
    } catch (e) {
      console.error("Error updating credits:", e);
      res.status(500).json({ error: "Não foi possível atualizar os créditos." });
    }
  });

  app.post("/api/plans/update", (req, res) => {
    const { id, content } = req.body;
    try {
      db.prepare("UPDATE plans_history SET content = ? WHERE id = ?").run(content, id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Erro ao atualizar plano" });
    }
  });

  // Students Routes
  app.get("/api/students/:userId", (req, res) => {
    const students = db.prepare("SELECT * FROM students WHERE user_id = ?").all(req.params.userId);
    res.json(students);
  });

  app.post("/api/students/add", (req, res) => {
    const { userId, name, classe } = req.body;
    try {
      db.prepare("INSERT INTO students (user_id, name, classe) VALUES (?, ?, ?)").run(userId, name, classe);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Erro ao adicionar aluno" });
    }
  });

  app.delete("/api/students/:id", (req, res) => {
    db.prepare("DELETE FROM students WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Calendar Routes
  app.get("/api/calendar/:userId", (req, res) => {
    const events = db.prepare("SELECT * FROM calendar_events WHERE user_id = ?").all(req.params.userId);
    res.json(events);
  });

  app.post("/api/calendar/add", (req, res) => {
    const { userId, title, start_date, end_date, plan_id } = req.body;
    try {
      db.prepare("INSERT INTO calendar_events (user_id, title, start_date, end_date, plan_id) VALUES (?, ?, ?, ?, ?)").run(
        userId, title, start_date, end_date, plan_id
      );
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Erro ao agendar aula" });
    }
  });

  app.delete("/api/calendar/:id", (req, res) => {
    db.prepare("DELETE FROM calendar_events WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Questions Bank Routes
  app.get("/api/questions/:userId", (req, res) => {
    const questions = db.prepare("SELECT * FROM questions_bank WHERE user_id = ? ORDER BY created_at DESC").all(req.params.userId);
    res.json(questions);
  });

  app.post("/api/questions/save", (req, res) => {
    const { userId, subject, classe, content } = req.body;
    try {
      db.prepare("INSERT INTO questions_bank (user_id, subject, classe, content) VALUES (?, ?, ?, ?)").run(
        userId, subject, classe, content
      );
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Erro ao salvar questões" });
    }
  });

  // Library Routes
  // Use a persistent path for library files in production
  const libraryPath = process.env.NODE_ENV === 'production' 
    ? path.join(process.cwd(), 'biblioteca') 
    : path.join(__dirname, "public", "biblioteca");
  const FOLDER_DOCS = "Centrais de Documentos";
  const CLASSES_NOMES = ["Iniciação", "1ª Classe", "2ª Classe", "3ª Classe", "4ª Classe", "5ª Classe", "6ª Classe"];
  
  const ESTRUTURA_DOCS: Record<string, string[] | null> = {
    "Programas do Ensino Primário": ["Iniciação", "1ª Classe", "2ª Classe", "3ª Classe", "4ª Classe", "5ª Classe", "6ª Classe"],
    "Cadernos de Avaliação": null,
    "Calendário Escolar": null,
    "Constituição da República": null,
    "Currículo por Níveis": null,
    "Decretos Presidenciais": null,
    "Diário da República": null,
    "Dosificação": null,
    "Estatuto da Carreira Docente": null,
    "Estatuto da Carreira do Ministério da Educação": null,
    "Leis de Bases": null,
    "Regulamento Escolar": null,
    "Outros Documentos": null
  };

  // Initialize Physical Structure
  if (!fs.existsSync(libraryPath)) fs.mkdirSync(libraryPath, { recursive: true });
  
  // Cleanup old structure if needed (optional but recommended for "apaga todas as pastas")
  const docsPath = path.join(libraryPath, FOLDER_DOCS);
  // We delete the old "Central_Documentos" if it exists under the old name
  const oldDocsPath = path.join(libraryPath, "Central_Documentos");
  if (fs.existsSync(oldDocsPath)) fs.rmSync(oldDocsPath, { recursive: true, force: true });
  
  // Create Classes folders
  CLASSES_NOMES.forEach(c => {
    const p = path.join(libraryPath, c);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  });

  // Create Central Docs structure
  if (!fs.existsSync(docsPath)) fs.mkdirSync(docsPath, { recursive: true });

  Object.entries(ESTRUTURA_DOCS).forEach(([folder, subs]) => {
    const p = path.join(docsPath, folder);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    if (subs) {
      subs.forEach(sub => {
        const sp = path.join(p, sub);
        if (!fs.existsSync(sp)) fs.mkdirSync(sp, { recursive: true });
      });
    }
  });

  // Remove unwanted subfolder as requested by user
  const unwantedSubfolder = path.join(docsPath, "Programas do Ensino Primário", "Centrais de Documentos");
  if (fs.existsSync(unwantedSubfolder)) fs.rmSync(unwantedSubfolder, { recursive: true, force: true });
  
  const unwantedSubfolderLower = path.join(docsPath, "Programas do Ensino Primário", "centrais de documentos");
  if (fs.existsSync(unwantedSubfolderLower)) fs.rmSync(unwantedSubfolderLower, { recursive: true, force: true });

  app.get("/api/library/files", (req, res) => {
    if (!fs.existsSync(libraryPath)) fs.mkdirSync(libraryPath, { recursive: true });
    
    const getFiles = (dir: string): any[] => {
      if (!fs.existsSync(dir)) return [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      return entries.map(entry => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          return { name: entry.name, type: 'directory', path: fullPath.replace(libraryPath, ''), children: getFiles(fullPath) };
        } else {
          return { name: entry.name, type: 'file', path: fullPath.replace(libraryPath, '') };
        }
      });
    };
    res.json(getFiles(libraryPath));
  });

  // File Upload and Delete
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const folder = req.body.folder || "";
      const dest = path.join(libraryPath, folder);
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
    },
    filename: (req, file, cb) => {
      cb(null, file.originalname);
    }
  });
  const upload = multer({ storage });

  app.post("/api/admin/library/upload", upload.single("file"), (req, res) => {
    res.json({ success: true });
  });

  app.delete("/api/admin/library/file", (req, res) => {
    const { filepath } = req.body;
    const fullPath = path.join(libraryPath, filepath);
    if (fs.existsSync(fullPath)) {
      if (fs.lstatSync(fullPath).isDirectory()) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(fullPath);
      }
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Arquivo não encontrado" });
    }
  });

  app.post("/api/admin/library/folder", (req, res) => {
    const { folderpath } = req.body;
    const fullPath = path.join(libraryPath, folderpath);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      res.json({ success: true });
    } else {
      res.status(400).json({ error: "Pasta já existe" });
    }
  });

  app.get("/api/library/view/:filepath", (req, res) => {
    const filePath = path.join(libraryPath, req.params.filepath);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath);
      const base64 = data.toString('base64');
      res.json({ base64 });
    } else {
      res.status(404).send("Arquivo não encontrado");
    }
  });

  app.get("/api/library/extract-text/:filepath", async (req, res) => {
    const filePath = path.join(libraryPath, req.params.filepath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Arquivo não encontrado" });

    try {
      const fileBuffer = fs.readFileSync(filePath);
      const extension = path.extname(filePath).toLowerCase();
      let text = "";

      if (extension === ".pdf") {
        const pdfParse = await import("pdf-parse");
        // Handle both ES and CJS module formats
        const parseFunc = (pdfParse as any).default || pdfParse;
        const data = await parseFunc(fileBuffer);
        text = data.text;
      } else if (extension === ".docx") {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        text = result.value;
      } else if (extension === ".txt") {
        text = fileBuffer.toString("utf-8");
      }

      // Limit text size to avoid overwhelming the AI prompt (e.g., first 50k characters)
      res.json({ text: text.slice(0, 50000) });
    } catch (err) {
      console.error("Error extracting text:", err);
      res.status(500).json({ error: "Erro ao extrair texto do documento" });
    }
  });

  app.get("/api/news", (req, res) => {
    const news = db.prepare("SELECT * FROM news WHERE expires_at IS NULL OR expires_at > datetime('now') ORDER BY date DESC").all();
    res.json(news);
  });

  app.post("/api/admin/news", (req, res) => {
    const { title, content, category, source, expires_in_days } = req.body;
    const expiresAt = expires_in_days ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000).toISOString() : null;
    
    try {
      db.prepare("INSERT INTO news (title, content, category, source, expires_at) VALUES (?, ?, ?, ?, ?)").run(
        title, content, category, source || 'Portal Pedagógico Angola', expiresAt
      );
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Erro ao publicar notícia" });
    }
  });

  app.delete("/api/admin/news/:id", (req, res) => {
    db.prepare("DELETE FROM news WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Feedback Routes
  app.post("/api/feedback", async (req, res) => {
    const { userId, content, type } = req.body;
    try {
      db.prepare("INSERT INTO feedback (user_id, content, type) VALUES (?, ?, ?)").run(userId, content, type);
      
      // Notify admin
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as User;
      sendAdminNotification(
        `Novo Feedback Recebido: ${type.toUpperCase()}`,
        `Usuário: ${user.professor_nome || user.email || user.telefone}\nTipo: ${type}\n\nConteúdo:\n${content}`
      );

      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Erro ao enviar feedback" });
    }
  });

  app.get("/api/admin/feedback", (req, res) => {
    const feedback = db.prepare(`
      SELECT f.*, u.professor_nome, u.email, u.telefone 
      FROM feedback f 
      JOIN users u ON f.user_id = u.id 
      ORDER BY f.created_at DESC
    `).all();
    res.json(feedback);
  });

  app.post("/api/admin/feedback/resolve", (req, res) => {
    const { id } = req.body;
    db.prepare("UPDATE feedback SET status = 'Resolvido' WHERE id = ?").run(id);
    res.json({ success: true });
  });

  // AI News Sync - DEPRECATED (Moved to frontend)
  app.post("/api/ai/sync-news", async (req, res) => {
    res.status(410).json({ error: "Endpoint movido para o frontend por motivos de segurança e conformidade." });
  });

  // Community Repository Routes
  app.get("/api/community/plans", (req, res) => {
    const plans = db.prepare(`
      SELECT cp.*, u.professor_nome, u.escola, u.foto_url
      FROM community_plans cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.status = 'Aprovado'
      ORDER BY cp.created_at DESC
    `).all();
    res.json(plans);
  });

  app.post("/api/community/share", (req, res) => {
    const { userId, planId, title, subject, classe, content } = req.body;
    try {
      // Check if already shared
      const existing = db.prepare("SELECT id FROM community_plans WHERE plan_id = ?").get(planId);
      if (existing) return res.status(400).json({ error: "Este plano já foi partilhado." });

      db.prepare(`
        INSERT INTO community_plans (user_id, plan_id, title, subject, classe, content)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(userId, planId, title, subject, classe, content);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Erro ao partilhar plano." });
    }
  });

  app.post("/api/community/like", (req, res) => {
    const { id } = req.body;
    db.prepare("UPDATE community_plans SET likes = likes + 1 WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.get("/api/admin/community/pending", (req, res) => {
    const plans = db.prepare(`
      SELECT cp.*, u.professor_nome, u.email, u.telefone
      FROM community_plans cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.status = 'Pendente'
      ORDER BY cp.created_at ASC
    `).all();
    res.json(plans);
  });

  app.post("/api/admin/community/moderate", (req, res) => {
    const { id, status } = req.body; // status: 'Aprovado' or 'Rejeitado'
    db.prepare("UPDATE community_plans SET status = ? WHERE id = ?").run(status, id);
    res.json({ success: true });
  });

  // Google Drive Integration
  app.get("/api/auth/google/url", (req, res) => {
    const redirectUri = `${process.env.APP_URL}/auth/google/callback`;
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/drive.file',
      access_type: 'offline',
      prompt: 'consent'
    });
    res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
  });

  app.get("/auth/google/callback", async (req, res) => {
    const { code } = req.query;
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', code: '${code}' }, '*');
              window.close();
            }
          </script>
          <p>Autenticação concluída. Pode fechar esta janela.</p>
        </body>
      </html>
    `);
  });

  app.post("/api/google/upload", async (req, res) => {
    const { code, title, content } = req.body;
    try {
      // Exchange code for tokens
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: code as string,
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          redirect_uri: `${process.env.APP_URL}/auth/google/callback`,
          grant_type: 'authorization_code'
        })
      });
      const tokens = await tokenRes.json();
      
      if (!tokens.access_token) throw new Error("Falha ao obter token");

      // Upload file to Google Drive
      const metadata = {
        name: `${title}.md`,
        mimeType: 'text/markdown'
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([content], { type: 'text/markdown' }));

      const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokens.access_token}` },
        body: form
      });

      const uploadData = await uploadRes.json();
      res.json({ success: true, fileId: uploadData.id });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erro ao enviar para o Google Drive" });
    }
  });

  app.get("/api/settings/logo", (req, res) => {
    const logo = db.prepare("SELECT value FROM settings WHERE key = 'logo'").get() as { value: string } | undefined;
    res.json({ logo: logo?.value || null });
  });

  app.post("/api/admin/upload-logo", (req, res) => {
    const { logo } = req.body; // Expecting base64
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('logo', ?)").run(logo);
    res.json({ success: true });
  });

  app.get("/api/admin/users", (req, res) => {
    try {
      const users = db.prepare("SELECT id, email, telefone, password, data_ativacao, data_expiracao, plano_tipo, limite_planos, planos_consumidos, status, is_admin, escola, professor_nome, provincia, municipio, numero_agente, biografia, especializacoes, foto_url FROM users").all();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Erro ao buscar usuários" });
    }
  });

  app.post("/api/admin/update-user", (req, res) => {
    const { id, data_expiracao, plano_tipo, limite_planos, status, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User;
    
    const wasPendente = user.status === 'Pendente';
    const isNowAtivo = status === 'Ativo';

    db.prepare(`
      UPDATE users 
      SET data_expiracao = ?, plano_tipo = ?, limite_planos = ?, status = ?, data_ativacao = ?, password = ?
      WHERE id = ?
    `).run(data_expiracao, plano_tipo, limite_planos, status, new Date().toISOString(), password || user.password, id);

    let activationMessage = null;
    if (wasPendente && isNowAtivo) {
      activationMessage = `Acesso permitido. Bem-vindo(a) ao Portal Pedagógico Angola (PPA). A sua Senha é ${user.password}`;
    }

    res.json({ success: true, activationMessage });
  });

  // Curriculum Management
  app.get("/api/curriculum", (req, res) => {
    const data = db.prepare("SELECT * FROM curriculum").all();
    res.json(data);
  });

  app.post("/api/admin/curriculum/add", (req, res) => {
    const { type, classe, disciplina, tema, subtema, sumario } = req.body;
    
    try {
      if (type === 'disciplina') {
        const exists = db.prepare("SELECT id FROM curriculum WHERE classe = ? AND disciplina = ?").get(classe, disciplina);
        if (!exists) {
          db.prepare("INSERT INTO curriculum (classe, disciplina) VALUES (?, ?)").run(classe, disciplina);
        }
      } else if (type === 'tema') {
        // Try to find a placeholder for the discipline (where tema is NULL)
        const placeholder = db.prepare("SELECT id FROM curriculum WHERE classe = ? AND disciplina = ? AND tema IS NULL").get(classe, disciplina) as any;
        if (placeholder) {
          db.prepare("UPDATE curriculum SET tema = ? WHERE id = ?").run(tema, placeholder.id);
        } else {
          const exists = db.prepare("SELECT id FROM curriculum WHERE classe = ? AND disciplina = ? AND tema = ?").get(classe, disciplina, tema);
          if (!exists) {
            db.prepare("INSERT INTO curriculum (classe, disciplina, tema) VALUES (?, ?, ?)").run(classe, disciplina, tema);
          }
        }
      } else if (type === 'subtema') {
        // Try to find a placeholder for the theme (where subtema is NULL)
        const placeholder = db.prepare("SELECT id FROM curriculum WHERE classe = ? AND disciplina = ? AND tema = ? AND subtema IS NULL").get(classe, disciplina, tema) as any;
        if (placeholder) {
          db.prepare("UPDATE curriculum SET subtema = ? WHERE id = ?").run(subtema, placeholder.id);
        } else {
          const exists = db.prepare("SELECT id FROM curriculum WHERE classe = ? AND disciplina = ? AND tema = ? AND subtema = ?").get(classe, disciplina, tema, subtema);
          if (!exists) {
            db.prepare("INSERT INTO curriculum (classe, disciplina, tema, subtema) VALUES (?, ?, ?, ?)").run(classe, disciplina, tema, subtema);
          }
        }
      } else if (type === 'sumario') {
        let target;
        if (subtema) {
          target = db.prepare("SELECT * FROM curriculum WHERE classe = ? AND disciplina = ? AND tema = ? AND subtema = ?").get(classe, disciplina, tema, subtema) as any;
        } else {
          target = db.prepare("SELECT * FROM curriculum WHERE classe = ? AND disciplina = ? AND tema = ? AND subtema IS NULL").get(classe, disciplina, tema) as any;
        }
        
        if (target) {
          const sumarios = JSON.parse(target.sumarios || "[]");
          if (!sumarios.includes(sumario)) {
            sumarios.push(sumario);
            db.prepare("UPDATE curriculum SET sumarios = ? WHERE id = ?").run(JSON.stringify(sumarios), target.id);
          }
        }
      }
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erro ao adicionar item" });
    }
  });

  app.post("/api/admin/curriculum/edit", (req, res) => {
    const { type, oldData, newData } = req.body;
    const { classe, disciplina, tema, subtema, sumario } = oldData;
    const st = subtema || '';

    if (type === 'disciplina') {
      db.prepare("UPDATE curriculum SET disciplina = ? WHERE classe = ? AND disciplina = ?").run(newData.name, classe, disciplina);
    } else if (type === 'tema') {
      db.prepare("UPDATE curriculum SET tema = ? WHERE classe = ? AND disciplina = ? AND tema = ?").run(newData.name, classe, disciplina, tema);
    } else if (type === 'subtema') {
      db.prepare("UPDATE curriculum SET subtema = ? WHERE classe = ? AND disciplina = ? AND tema = ? AND subtema = ?").run(newData.name, classe, disciplina, tema, st);
    } else if (type === 'sumario') {
      const existing = db.prepare("SELECT * FROM curriculum WHERE classe = ? AND disciplina = ? AND tema = ? AND subtema = ?").get(classe, disciplina, tema, st) as any;
      if (existing) {
        let sumarios = JSON.parse(existing.sumarios || "[]");
        const idx = sumarios.indexOf(sumario);
        if (idx !== -1) {
          sumarios[idx] = newData.name;
          db.prepare("UPDATE curriculum SET sumarios = ? WHERE id = ?").run(JSON.stringify(sumarios), existing.id);
        }
      }
    }
    res.json({ success: true });
  });

  app.post("/api/admin/curriculum/remove", (req, res) => {
    const { classe, disciplina, tema, subtema, sumario } = req.body;
    
    try {
      if (sumario) {
        let target;
        if (subtema) {
          target = db.prepare("SELECT * FROM curriculum WHERE classe = ? AND disciplina = ? AND tema = ? AND subtema = ?").get(classe, disciplina, tema, subtema) as any;
        } else {
          target = db.prepare("SELECT * FROM curriculum WHERE classe = ? AND disciplina = ? AND tema = ? AND subtema IS NULL").get(classe, disciplina, tema) as any;
        }

        if (target) {
          let sumarios = JSON.parse(target.sumarios || "[]");
          sumarios = sumarios.filter((s: string) => s !== sumario);
          db.prepare("UPDATE curriculum SET sumarios = ? WHERE id = ?").run(JSON.stringify(sumarios), target.id);
        }
      } else if (subtema) {
        db.prepare("DELETE FROM curriculum WHERE classe = ? AND disciplina = ? AND tema = ? AND subtema = ?").run(classe, disciplina, tema, subtema);
        // If theme is now empty (no subthemes), restore placeholder to keep theme alive?
        // Check if any subthemes remain for this theme
        const remaining = db.prepare("SELECT count(*) as count FROM curriculum WHERE classe = ? AND disciplina = ? AND tema = ?").get(classe, disciplina, tema) as any;
        if (remaining.count === 0) {
           db.prepare("INSERT INTO curriculum (classe, disciplina, tema) VALUES (?, ?, ?)").run(classe, disciplina, tema);
        }
      } else if (tema) {
        db.prepare("DELETE FROM curriculum WHERE classe = ? AND disciplina = ? AND tema = ?").run(classe, disciplina, tema);
        // If discipline is now empty, restore placeholder
        const remaining = db.prepare("SELECT count(*) as count FROM curriculum WHERE classe = ? AND disciplina = ?").get(classe, disciplina) as any;
        if (remaining.count === 0) {
           db.prepare("INSERT INTO curriculum (classe, disciplina) VALUES (?, ?)").run(classe, disciplina);
        }
      } else if (disciplina) {
        db.prepare("DELETE FROM curriculum WHERE classe = ? AND disciplina = ?").run(classe, disciplina);
      }
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erro ao remover item" });
    }
  });

  app.post("/api/admin/update-settings", (req, res) => {
    const fields = [
      'escola', 'professor', 'provincia', 'municipio',
      'smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass', 'admin_email'
    ];
    
    const settingsMap: Record<string, string> = {
      escola: 'default_escola',
      professor: 'default_professor',
      provincia: 'default_provincia',
      municipio: 'default_municipio',
      smtp_host: 'smtp_host',
      smtp_port: 'smtp_port',
      smtp_secure: 'smtp_secure',
      smtp_user: 'smtp_user',
      smtp_pass: 'smtp_pass',
      admin_email: 'admin_email'
    };

    for (const field of fields) {
      if (req.body[field] !== undefined && req.body[field] !== null) {
        let value = req.body[field];
        if (field === 'smtp_secure') {
          value = value === true || value === 'true' ? 'true' : 'false';
        }
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(settingsMap[field], String(value));
      }
    }
    
    res.json({ success: true });
  });

  app.get("/api/settings", (req, res) => {
    const settings = db.prepare("SELECT * FROM settings").all() as { key: string, value: string }[];
    const result: Record<string, string> = {};
    settings.forEach(s => result[s.key] = s.value);
    res.json(result);
  });

  // Word Generation
  app.post("/api/ai/export-docx", async (req, res) => {
    const { plano, escola, professor, disciplina, classe, trimestre, aula_numero, tempo, template, provincia, municipio } = req.body;
    
    const headerText = template === 'Pública' ? "MINISTÉRIO DA EDUCAÇÃO" : "REPÚBLICA DE ANGOLA";
    const subHeaderText = template === 'Luanda' ? "GOVERNO PROVINCIAL DE LUANDA" : 
                         template === 'Benguela' ? "GOVERNO PROVINCIAL DE BENGUELA" :
                         template === 'Huambo' ? "GOVERNO PROVINCIAL DO HUAMBO" : "";

    const children = [
      new Paragraph({
        text: headerText,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
      }),
    ];

    if (subHeaderText) {
      children.push(new Paragraph({
        text: subHeaderText,
        alignment: AlignmentType.CENTER,
      }));
    }

    children.push(
      new Paragraph({ text: "" }),
      new Paragraph({
        children: [
          new TextRun({ text: `ESCOLA: ${escola.toUpperCase()}`, bold: true, size: 24 }),
        ],
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({ text: "" }),
      new Paragraph({
        border: { bottom: { color: "auto", space: 1, style: BorderStyle.SINGLE, size: 6 } },
        children: [
          new TextRun({ text: "PLANO DE AULA", bold: true, size: 28 }),
        ],
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({ text: "" }),
      new Paragraph({
        children: [
          new TextRun({ text: "DADOS INFORMATIVOS", bold: true }),
        ],
      }),
      new Paragraph({ children: [new TextRun({ text: "Professor: ", bold: true }), new TextRun(professor)] }),
      new Paragraph({ children: [new TextRun({ text: "Província: ", bold: true }), new TextRun(provincia || "Não definida")] }),
      new Paragraph({ children: [new TextRun({ text: "Município: ", bold: true }), new TextRun(municipio || "Não definido")] }),
      new Paragraph({ children: [new TextRun({ text: "Disciplina: ", bold: true }), new TextRun(disciplina)] }),
      new Paragraph({ children: [new TextRun({ text: "Classe: ", bold: true }), new TextRun(classe)] }),
      new Paragraph({ children: [new TextRun({ text: "Trimestre: ", bold: true }), new TextRun(trimestre)] }),
      new Paragraph({ children: [new TextRun({ text: "Aula nº: ", bold: true }), new TextRun(aula_numero.toString())] }),
      new Paragraph({ children: [new TextRun({ text: "Tempo: ", bold: true }), new TextRun(`${tempo} min`)] }),
      new Paragraph({ text: "" }),
      new Paragraph({
        border: { bottom: { color: "auto", space: 1, style: BorderStyle.SINGLE, size: 6 } },
        children: [
          new TextRun({ text: "DESENVOLVIMENTO DO PLANO", bold: true }),
        ],
      }),
      new Paragraph({ text: "" }),
      ...plano.split('\n').map((line: string) => {
        if (line.startsWith('# ')) {
          return new Paragraph({ text: line.replace('# ', ''), heading: HeadingLevel.HEADING_2 });
        } else if (line.startsWith('## ')) {
          return new Paragraph({ text: line.replace('## ', ''), heading: HeadingLevel.HEADING_3 });
        }
        return new Paragraph({ text: line });
      }),
      new Paragraph({ text: "" }),
      new Paragraph({
        children: [
          new TextRun({ text: "________________________________", bold: true }),
        ],
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "O Professor", size: 20 }),
        ],
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({ text: "" }),
      new Paragraph({
        children: [
          new TextRun({ text: "Gerado por Portal Pedagógico Angola (PPA) - Qualidade INIDE", italics: true, color: "888888", size: 16 }),
        ],
        alignment: AlignmentType.RIGHT,
      })
    );

    const doc = new Document({
      sections: [{
        properties: {},
        children: children,
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename=plano_de_aula.docx');
    res.send(buffer);
  });

  app.get("/api/stats/:userId", (req, res) => {
    const { userId } = req.params;
    const plansByMonth = db.prepare(`
      SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count 
      FROM plans_history 
      WHERE user_id = ? 
      GROUP BY month 
      ORDER BY month ASC 
      LIMIT 6
    `).all(userId);

    const subjectsCount = db.prepare(`
      SELECT json_extract(metadata, '$.disciplina') as subject, COUNT(*) as count 
      FROM plans_history 
      WHERE user_id = ? AND subject IS NOT NULL
      GROUP BY subject 
      ORDER BY count DESC
    `).all(userId);

    res.json({ plansByMonth, subjectsCount });
  });

  app.post("/api/profile/update", (req, res) => {
    const { id, professor_nome, numero_agente, biografia, especializacoes, foto_url, escola, provincia, municipio } = req.body;
    db.prepare(`
      UPDATE users 
      SET professor_nome = ?, numero_agente = ?, biografia = ?, especializacoes = ?, foto_url = ?, escola = ?, provincia = ?, municipio = ? 
      WHERE id = ?
    `).run(professor_nome, numero_agente, biografia, especializacoes, foto_url, escola, provincia, municipio, id);
    
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    res.json({ user });
  });

  // Catch-all for API routes to return a JSON 404
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve library files from persistent storage in production
    app.use('/biblioteca', express.static(libraryPath));

    app.use(express.static(path.join(__dirname, "dist"), {
      setHeaders: (res, p) => {
        if (p.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      }
    }));

    const distPath = path.join(__dirname, "dist");
    if (!fs.existsSync(distPath)) {
      console.warn("WARNING: 'dist' folder not found. Did you run 'npm run build'?");
    } else {
      console.log("'dist' folder found, serving static files.");
    }

    app.get("*", (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  } catch (error) {
    console.error("FATAL SERVER ERROR:", error);
    process.exit(1);
  }
}

startServer();
