-- ═══════════════════════════════════════════════════════════════
-- HIGH SCHOOL MANAGEMENT SYSTEM — Complete Database Schema
-- Run this file once to set up the entire database
-- Compatible with MySQL 8.0+
-- ═══════════════════════════════════════════════════════════════

-- Create and select the database
CREATE DATABASE IF NOT EXISTS highschool_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE highschool_db;

-- ───────────────────────────────────────────────────────────────
-- TABLE: users
-- Stores all users: Admin, Teacher, Student
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(36)  NOT NULL PRIMARY KEY,          -- UUID
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin','teacher','student') NOT NULL,
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  public_key    TEXT         NULL,                          -- E2EE RSA public key (Phase 4)
  last_login    TIMESTAMP    NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_users_email  (email),
  INDEX idx_users_role   (role),
  INDEX idx_users_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────
-- TABLE: refresh_tokens
-- Stores hashed refresh tokens for JWT rotation
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          VARCHAR(36)  NOT NULL PRIMARY KEY,
  user_id     VARCHAR(36)  NOT NULL,
  token_hash  VARCHAR(255) NOT NULL UNIQUE,               -- bcrypt hash of the token
  expires_at  TIMESTAMP    NOT NULL,
  revoked     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_rt_user    (user_id),
  INDEX idx_rt_revoked (revoked),
  INDEX idx_rt_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────
-- TABLE: classes
-- Represents Class 8, 9, 10
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS classes (
  id          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  class_name  ENUM('8','9','10') NOT NULL UNIQUE,
  created_by  VARCHAR(36)  NOT NULL,                      -- Admin who created it
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_classes_name (class_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────
-- TABLE: sections
-- Each class can have multiple sections (A, B, C...)
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sections (
  id           INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  class_id     INT          NOT NULL,
  section_name VARCHAR(5)   NOT NULL,                     -- A, B, C, D...
  created_by   VARCHAR(36)  NOT NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (class_id)   REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)   ON DELETE RESTRICT,
  UNIQUE KEY uq_class_section (class_id, section_name),
  INDEX idx_sections_class (class_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────
-- TABLE: student_sections
-- Maps students to their assigned section (one at a time)
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_sections (
  id          INT         NOT NULL AUTO_INCREMENT PRIMARY KEY,
  student_id  VARCHAR(36) NOT NULL,
  section_id  INT         NOT NULL,
  enrolled_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (student_id) REFERENCES users(id)     ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES sections(id)  ON DELETE CASCADE,
  UNIQUE KEY uq_student_section (student_id),        -- one section per student
  INDEX idx_ss_section (section_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────
-- TABLE: subjects
-- ADMIN-ONLY: only admins can insert/update/delete here
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subjects (
  id           INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  subject_name VARCHAR(100) NOT NULL UNIQUE,
  created_by   VARCHAR(36)  NOT NULL,                    -- must be an Admin
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_subjects_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────
-- TABLE: student_subjects
-- Students SELECT from Admin-created subjects
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_subjects (
  id          INT         NOT NULL AUTO_INCREMENT PRIMARY KEY,
  student_id  VARCHAR(36) NOT NULL,
  subject_id  INT         NOT NULL,
  selected_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (student_id) REFERENCES users(id)     ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id)  ON DELETE CASCADE,
  UNIQUE KEY uq_student_subject (student_id, subject_id),
  INDEX idx_stu_sub_student (student_id),
  INDEX idx_stu_sub_subject (subject_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────
-- TABLE: teacher_subjects
-- Maps teachers to the subjects they teach
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teacher_subjects (
  id          INT         NOT NULL AUTO_INCREMENT PRIMARY KEY,
  teacher_id  VARCHAR(36) NOT NULL,
  subject_id  INT         NOT NULL,
  section_id  INT         NOT NULL,
  assigned_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (teacher_id) REFERENCES users(id)     ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id)  ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES sections(id)  ON DELETE CASCADE,
  UNIQUE KEY uq_teacher_subject_section (teacher_id, subject_id, section_id),
  INDEX idx_ts_teacher (teacher_id),
  INDEX idx_ts_subject (subject_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────
-- TABLE: attendance
-- Daily attendance per student per subject
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id          INT         NOT NULL AUTO_INCREMENT PRIMARY KEY,
  student_id  VARCHAR(36) NOT NULL,
  subject_id  INT         NOT NULL,
  teacher_id  VARCHAR(36) NOT NULL,
  date        DATE        NOT NULL,
  status      ENUM('present','absent','late') NOT NULL DEFAULT 'present',
  remarks     VARCHAR(255) NULL,
  created_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (student_id) REFERENCES users(id)     ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id)  ON DELETE RESTRICT,
  FOREIGN KEY (teacher_id) REFERENCES users(id)     ON DELETE RESTRICT,
  UNIQUE KEY uq_attendance (student_id, subject_id, date),
  INDEX idx_att_student (student_id),
  INDEX idx_att_date    (date),
  INDEX idx_att_subject (subject_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────
-- TABLE: marks
-- Encrypted marks per student per subject per exam
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marks (
  id              INT         NOT NULL AUTO_INCREMENT PRIMARY KEY,
  student_id      VARCHAR(36) NOT NULL,
  subject_id      INT         NOT NULL,
  teacher_id      VARCHAR(36) NOT NULL,
  exam_type       VARCHAR(50) NOT NULL,               -- 'unit_test','midterm','final'
  marks_value     DECIMAL(5,2) NULL,                  -- plaintext (Phase 1-3)
  marks_encrypted TEXT        NULL,                   -- ciphertext (Phase 4)
  encrypted_key   TEXT        NULL,                   -- RSA-wrapped AES key (Phase 4)
  max_marks       INT         NOT NULL DEFAULT 100,
  remarks         VARCHAR(255) NULL,
  created_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (student_id) REFERENCES users(id)     ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id)  ON DELETE RESTRICT,
  FOREIGN KEY (teacher_id) REFERENCES users(id)     ON DELETE RESTRICT,
  UNIQUE KEY uq_marks (student_id, subject_id, exam_type),
  INDEX idx_marks_student (student_id),
  INDEX idx_marks_subject (subject_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────
-- TABLE: materials
-- Study materials uploaded by teachers
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS materials (
  id              INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  subject_id      INT          NOT NULL,
  teacher_id      VARCHAR(36)  NOT NULL,
  title           VARCHAR(200) NOT NULL,
  description     TEXT         NULL,
  file_path       VARCHAR(500) NOT NULL,
  file_name       VARCHAR(200) NOT NULL,
  file_type       VARCHAR(20)  NOT NULL,              -- pdf, docx, pptx, jpg, png
  file_size_kb    INT          NULL,
  is_encrypted    BOOLEAN      NOT NULL DEFAULT FALSE, -- Phase 4
  uploaded_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES users(id)    ON DELETE RESTRICT,
  INDEX idx_materials_subject (subject_id),
  INDEX idx_materials_teacher (teacher_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────
-- TABLE: notifications
-- In-app notification system
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id           INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  recipient_id VARCHAR(36)  NOT NULL,
  sender_id    VARCHAR(36)  NULL,                     -- NULL = system notification
  title        VARCHAR(200) NOT NULL,
  message      TEXT         NOT NULL,
  type         ENUM('assignment','marks','attendance','announcement','system') NOT NULL DEFAULT 'system',
  is_read      BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notif_recipient (recipient_id),
  INDEX idx_notif_read      (is_read),
  INDEX idx_notif_created   (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────
-- TABLE: audit_logs
-- Append-only log of all sensitive actions
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id           INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id      VARCHAR(36)  NULL,                     -- NULL if unauthenticated action
  action       VARCHAR(100) NOT NULL,                 -- e.g. 'USER_LOGIN', 'SUBJECT_CREATED'
  entity_type  VARCHAR(50)  NULL,                     -- e.g. 'user', 'subject', 'section'
  entity_id    VARCHAR(36)  NULL,                     -- the ID of the affected record
  ip_address   VARCHAR(45)  NULL,                     -- IPv4 or IPv6
  user_agent   VARCHAR(500) NULL,
  details      JSON         NULL,                     -- extra context (old/new values etc.)
  performed_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_audit_user    (user_id),
  INDEX idx_audit_action  (action),
  INDEX idx_audit_date    (performed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ═══════════════════════════════════════════════════════════════
-- SEED DATA — Default Admin user
-- Password: Admin@1234  (hashed with bcrypt, 12 rounds)
-- CHANGE THIS PASSWORD immediately after first login!
-- ═══════════════════════════════════════════════════════════════
INSERT IGNORE INTO users (id, name, email, password_hash, role, is_active)
VALUES (
  'admin-uuid-0000-0000-000000000001',
  'System Admin',
  'sbhuvan847@gmail.com',
  'Admin@1234',
  'admin',
  TRUE
);

-- Seed: Classes 8, 9, 10
INSERT IGNORE INTO classes (class_name, created_by) VALUES
  ('8',  'admin-uuid-0000-0000-000000000001'),
  ('9',  'admin-uuid-0000-0000-000000000001'),
  ('10', 'admin-uuid-0000-0000-000000000001');

-- Seed: Default sections for each class
INSERT IGNORE INTO sections (class_id, section_name, created_by)
SELECT c.id, s.section_name, 'admin-uuid-0000-0000-000000000001'
FROM classes c
CROSS JOIN (
  SELECT 'A' AS section_name UNION ALL
  SELECT 'B' UNION ALL
  SELECT 'C'
) s;

-- Seed: Core subjects
INSERT IGNORE INTO subjects (subject_name, created_by) VALUES
  ('Mathematics',        'admin-uuid-0000-0000-000000000001'),
  ('Science',            'admin-uuid-0000-0000-000000000001'),
  ('English',            'admin-uuid-0000-0000-000000000001'),
  ('Social Studies',     'admin-uuid-0000-0000-000000000001'),
  ('Hindi',              'admin-uuid-0000-0000-000000000001'),
  ('Computer Science',   'admin-uuid-0000-0000-000000000001'),
  ('Physical Education', 'admin-uuid-0000-0000-000000000001');

-- Initial audit log entry
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
VALUES (
  'admin-uuid-0000-0000-000000000001',
  'DB_INITIALIZED',
  'system',
  NULL,
  JSON_OBJECT('message', 'Database schema and seed data created successfully')
);

-- ═══════════════════════════════════════════════════════════════
-- DONE
-- Default admin credentials:
--   Email:    sbhuvan847@gmail.com
--   Password: Admin@1234
-- ═══════════════════════════════════════════════════════════════
