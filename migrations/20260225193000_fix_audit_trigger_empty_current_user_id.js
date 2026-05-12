/**
 * Corrige el trigger de auditoría para tolerar app.current_user_id = ''.
 * Antes hacía cast directo a INTEGER y fallaba con tokens/contextos legacy.
 */
exports.up = async function up(knex) {
  await knex.raw(`
    CREATE OR REPLACE FUNCTION public.log_table_changes()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $function$
    DECLARE
      v_usuario_id INTEGER;
      v_usuario_email VARCHAR(255);
      v_usuario_rol VARCHAR(50);
      v_datos_anteriores JSONB;
      v_datos_nuevos JSONB;
      v_cambios JSONB;
    BEGIN
      -- Tolerar valor vacío en el contexto para no romper el trigger
      v_usuario_id := NULLIF(current_setting('app.current_user_id', true), '')::INTEGER;
      v_usuario_email := NULLIF(current_setting('app.current_user_email', true), '');
      v_usuario_rol := NULLIF(current_setting('app.current_user_rol', true), '');
      
      IF TG_OP = 'DELETE' THEN
        v_datos_anteriores := to_jsonb(OLD);
        v_datos_nuevos := NULL;
        
        INSERT INTO audit_logs (
          usuario_id, usuario_email, usuario_rol,
          accion, tabla_afectada, registro_id,
          datos_anteriores, datos_nuevos
        ) VALUES (
          v_usuario_id, v_usuario_email, v_usuario_rol,
          'DELETE', TG_TABLE_NAME, OLD.id,
          v_datos_anteriores, v_datos_nuevos
        );
        RETURN OLD;
        
      ELSIF TG_OP = 'UPDATE' THEN
        v_datos_anteriores := to_jsonb(OLD);
        v_datos_nuevos := to_jsonb(NEW);
        
        SELECT jsonb_object_agg(key, value) INTO v_cambios
        FROM (
          SELECT key, value
          FROM jsonb_each(v_datos_nuevos)
          WHERE value IS DISTINCT FROM (v_datos_anteriores->key)
        ) AS changes;
        
        IF v_cambios IS NOT NULL AND v_cambios != '{}'::jsonb THEN
          INSERT INTO audit_logs (
            usuario_id, usuario_email, usuario_rol,
            accion, tabla_afectada, registro_id,
            datos_anteriores, datos_nuevos, cambios_realizados
          ) VALUES (
            v_usuario_id, v_usuario_email, v_usuario_rol,
            'UPDATE', TG_TABLE_NAME, NEW.id,
            v_datos_anteriores, v_datos_nuevos, v_cambios
          );
        END IF;
        RETURN NEW;
        
      ELSIF TG_OP = 'INSERT' THEN
        v_datos_nuevos := to_jsonb(NEW);
        
        INSERT INTO audit_logs (
          usuario_id, usuario_email, usuario_rol,
          accion, tabla_afectada, registro_id,
          datos_anteriores, datos_nuevos
        ) VALUES (
          v_usuario_id, v_usuario_email, v_usuario_rol,
          'CREATE', TG_TABLE_NAME, NEW.id,
          NULL, v_datos_nuevos
        );
        RETURN NEW;
      END IF;
    END;
    $function$;
  `);
};

exports.down = async function down(knex) {
  // No-op: no restauramos la versión vulnerable del trigger.
  return knex.raw('SELECT 1');
};
