// backend/testPostgres.js
const { testConnection, getAll, TABLES } = require('./services/postgresService');

const test = async () => {
  console.log('🧪 Probando conexión con PostgreSQL...');
  
  // Probar conexión
  const connected = await testConnection();
  if (!connected) {
    console.error('No se pudo conectar a PostgreSQL');
    process.exit(1);
  }
  
  // Probar obtener conductores
  try {
    console.log('\n📊 Obteniendo conductores...');
    const conductores = await getAll(TABLES.CONDUCTORES);
    console.log(`✅ Se encontraron ${conductores.length} conductores`);
    
    if (conductores.length > 0) {
      console.log('Primer conductor:', {
        id: conductores[0].id,
        nombre: conductores[0].nombre_conductor,
        status: conductores[0].status
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  process.exit(0);
};

test();