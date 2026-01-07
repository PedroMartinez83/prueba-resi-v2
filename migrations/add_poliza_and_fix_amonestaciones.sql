-- ========================================
-- MIGRACIÓN: Póliza Mecánica y Amonestaciones
-- ========================================

-- 1. AGREGAR COLUMNA SALDO_POLIZA_MECANICA
ALTER TABLE conductores 
ADD COLUMN IF NOT EXISTS saldo_poliza_mecanica NUMERIC(10, 2) DEFAULT 50000.00;

COMMENT ON COLUMN conductores.saldo_poliza_mecanica IS 'Saldo disponible en la póliza mecánica del conductor (default $50,000 MXN)';

-- 2. CREAR NUEVA TABLA AMONESTACIONES_CONDUCTORES
CREATE TABLE IF NOT EXISTS amonestaciones_conductores (
    id SERIAL PRIMARY KEY,
    conductor_id INTEGER NOT NULL REFERENCES conductores(id) ON DELETE CASCADE,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    motivo TEXT NOT NULL,
    descripcion TEXT,
    gravedad VARCHAR(50) DEFAULT 'leve' CHECK (gravedad IN ('leve', 'moderada', 'grave')),
    registrado_por_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    registrado_por_nombre VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_amonestaciones_conductores_conductor 
ON amonestaciones_conductores(conductor_id);

CREATE INDEX IF NOT EXISTS idx_amonestaciones_conductores_fecha 
ON amonestaciones_conductores(fecha DESC);

-- Comentarios
COMMENT ON TABLE amonestaciones_conductores IS 'Registro de amonestaciones del plan de carrera de conductores';
COMMENT ON COLUMN amonestaciones_conductores.gravedad IS 'Nivel de gravedad: leve, moderada, grave';

-- 3. TRIGGER PARA UPDATED_AT
CREATE OR REPLACE FUNCTION update_amonestaciones_conductores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_amonestaciones_conductores_timestamp
    BEFORE UPDATE ON amonestaciones_conductores
    FOR EACH ROW
    EXECUTE FUNCTION update_amonestaciones_conductores_updated_at();

-- 4. VERIFICAR RESULTADOS
SELECT 
    'conductores.saldo_poliza_mecanica' as campo,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conductores' 
        AND column_name = 'saldo_poliza_mecanica'
    ) THEN '✓ Existe' ELSE '✗ No existe' END as estado
UNION ALL
SELECT 
    'tabla amonestaciones_conductores' as campo,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'amonestaciones_conductores'
    ) THEN '✓ Existe' ELSE '✗ No existe' END as estado;