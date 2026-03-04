import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { requireAdmin } from "../auth/admin.middleware.js";
import {
    getDashboard,
    // Centros
    getCentros, crearCentro, actualizarCentro, eliminarCentro,
    // Cursos Escolares
    getCursosEscolares, crearCursoEscolar, actualizarCursoEscolar,
    // Planes de Estudio
    getPlanes, crearPlan, actualizarPlan, eliminarPlan,
    // Asignaturas
    getAsignaturas, crearAsignatura, actualizarAsignatura, eliminarAsignatura,
    // Ofertas
    getOfertas, crearOferta, eliminarOferta,
    // Clases
    getClases, getClaseDetalle, crearClase, actualizarClase, eliminarClase, toggleClaseActiva,
    // Matrículas
    getMatriculas, crearMatricula, eliminarMatricula,
    // Asignaciones Profesor
    getAsignaciones, crearAsignacion, eliminarAsignacion,
    // Personas y Usuarios Gobierno
    getPersonas, crearPersonaCompleta, actualizarPersona, resetPassword,
    // Usuarios App
    getUsuariosApp, toggleUsuarioAppActivo, cambiarRolUsuario,
    // Salas
    getSalas, updateSalaConfig,
    // Roles + Audit
    getRoles, getAuditLog,
    // Wizard
    getOfertasPorPlan, getProfesoresDisponibles, getAlumnosDisponibles,
    crearClaseCompleta, getClaseDetalladoWizard, updateMatriculaAsignaturas,
    eliminarCursoEscolar,
    actualizarOferta
} from "../academico/admin.controller.js";

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

// Dashboard
router.get("/dashboard", getDashboard);

// Centros CRUD
router.get("/centros", getCentros);
router.post("/centros", crearCentro);
router.put("/centros/:id", actualizarCentro);
router.delete("/centros/:id", eliminarCentro);

// Cursos Escolares
router.get("/cursos-escolares", getCursosEscolares);
router.post("/cursos-escolares", crearCursoEscolar);
router.put("/cursos-escolares/:id", actualizarCursoEscolar);
router.delete("/cursos-escolares/:id", eliminarCursoEscolar);

// Planes de Estudio CRUD
router.get("/planes", getPlanes);
router.post("/planes", crearPlan);
router.put("/planes/:id", actualizarPlan);
router.delete("/planes/:id", eliminarPlan);

// Asignaturas CRUD
router.get("/asignaturas", getAsignaturas);
router.post("/asignaturas", crearAsignatura);
router.put("/asignaturas/:id", actualizarAsignatura);
router.delete("/asignaturas/:id", eliminarAsignatura);

// Ofertas de Asignaturas
router.get("/ofertas", getOfertas);
router.post("/ofertas", crearOferta);
router.put("/ofertas/:id", actualizarOferta);
router.delete("/ofertas/:id", eliminarOferta);

// Clases CRUD
router.get("/clases", getClases);
router.get("/clases/:id", getClaseDetalle);
router.post("/clases", crearClase);
router.put("/clases/:id", actualizarClase);
router.delete("/clases/:id", eliminarClase);
router.put("/clases/:id/toggle-activa", toggleClaseActiva);

// Matrículas CRUD
router.get("/matriculas", getMatriculas);
router.post("/matriculas", crearMatricula);
router.delete("/matriculas/:id", eliminarMatricula);

// Asignaciones Profesor
router.get("/asignaciones", getAsignaciones);
router.post("/asignaciones", crearAsignacion);
router.delete("/asignaciones/:id", eliminarAsignacion);

// Personas y Usuarios Gobierno
router.get("/personas", getPersonas);
router.post("/personas", crearPersonaCompleta);
router.put("/personas/:id", actualizarPersona);
router.post("/reset-password", resetPassword);

// Usuarios App
router.get("/usuarios-app", getUsuariosApp);
router.put("/usuarios-app/:id/toggle-activo", toggleUsuarioAppActivo);
router.put("/usuarios-app/:id/cambiar-rol", cambiarRolUsuario);

// Salas de Chat
router.get("/salas", getSalas);
router.put("/salas/:id/config", updateSalaConfig);

// Roles
router.get("/roles", getRoles);

// Auditoría
router.get("/audit-log", getAuditLog);

// Wizard — Asistente de creación de clase
router.get("/wizard/ofertas-plan/:id_plan", getOfertasPorPlan);
router.get("/wizard/profesores", getProfesoresDisponibles);
router.get("/wizard/alumnos", getAlumnosDisponibles);
router.post("/wizard/crear-clase-completa", crearClaseCompleta);
router.get("/wizard/clase/:id", getClaseDetalladoWizard);
router.put("/wizard/matricula/:id/asignaturas", updateMatriculaAsignaturas);

export default router;