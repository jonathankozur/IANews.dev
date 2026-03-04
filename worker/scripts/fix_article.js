const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const neutralTitle = "Detención de detenido por plan de atentado contra funcionarios en Entre Ríos";
const neutralContent = `
### Introducción
La Policía Federal Argentina (PFA) detuvo a un hombre sospechoso de planificar un atentado contra jueces, fiscales y funcionarios de la provincia de Entre Ríos. La detención se produjo tras información proporcionada por otro detenido, vinculado a clanes de narcotráfico con supuestas conexiones políticas en la región.

### Antecedentes y Detención
La investigación comenzó a raíz de las declaraciones de un testigo clave procesado por narcotráfico, quien reveló detalles sobre el plan coordinado para atacar a integrantes del Poder Judicial y del ejecutivo provincial. Según los reportes policiales, el sospechoso estaba organizando inteligencia previa sobre los movimientos de los magistrados amenazados.

El operativo, coordinado por fuerzas federales en Entre Ríos, permitió la captura del individuo sin mayores incidentes. Se incautaron dispositivos electrónicos y material que, según el peritaje preliminar, confirmaría la vigilancia sobre los objetivos seleccionados.

### Medidas de Seguridad
Ante la gravedad de la amenaza, el Ministerio de Seguridad de la Nación dispuso el refuerzo inmediato de la custodia para los funcionarios involucrados. Se han establecido perímetros de seguridad y escoltas especiales tanto para la Policía Federal como para la Policía de Entre Ríos en las zonas de residencia y trabajo de los magistrados amenazados.

La causa continúa bajo secreto de sumario mientras se analizan posibles conexiones adicionales del sospechoso con organizaciones criminales de mayor escala que operan en el litoral argentino.
`;

async function run() {
    const { data, error } = await supabase
        .from('neutral_news')
        .update({
            title: neutralTitle,
            objective_summary: neutralContent,
            process_status: 'PUBLISHED'
        })
        .eq('id', '89659751-682f-43fe-971e-6fca46fc1ab8');

    if (error) {
        console.error("Error updating neutral_news:", error);
    } else {
        console.log("Neutral article updated successfully.");
    }
}

run();
