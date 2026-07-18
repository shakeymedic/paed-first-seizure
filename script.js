// ---------- copy rich text (exact required implementation, global scope) ----------
async function copyRichText() {
    const el = document.getElementById('epr-output');
    if (!el) return;
    const htmlContent = el.innerHTML;
    const plainText = el.innerText;
    const copyBtn = document.getElementById('copy-rich-text-btn');
    try {
        if (navigator.clipboard && window.ClipboardItem) {
            await navigator.clipboard.write([
                new ClipboardItem({
                    'text/html': new Blob([htmlContent], { type: 'text/html' }),
                    'text/plain': new Blob([plainText], { type: 'text/plain' })
                })
            ]);
        } else {
            await navigator.clipboard.writeText(plainText);
        }
        if (copyBtn) {
            const orig = copyBtn.textContent;
            copyBtn.textContent = '✓ Copied!';
            copyBtn.classList.add('bg-green-600');
            copyBtn.classList.remove('bg-blue-600');
            setTimeout(() => {
                copyBtn.textContent = orig;
                copyBtn.classList.remove('bg-green-600');
                copyBtn.classList.add('bg-blue-600');
            }, 1500);
        }
    } catch(e) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        document.execCommand('copy');
        sel.removeAllRanges();
        if (copyBtn) { copyBtn.textContent = '✓ Copied!'; setTimeout(() => { copyBtn.textContent = 'Copy Rich Text'; }, 1500); }
    }
}

document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'paed_seizure_data';
  const getEl = id => document.getElementById(id);

  // ---------- helpers ----------
  function calcAge(dobStr) {
    if (!dobStr) return '';
    const dob = new Date(dobStr);
    if (isNaN(dob.getTime())) return '';
    const now = new Date();
    let years = now.getFullYear() - dob.getFullYear();
    let months = now.getMonth() - dob.getMonth();
    if (now.getDate() < dob.getDate()) months--;
    if (months < 0) { years--; months += 12; }
    if (years < 1) {
      // show in months
      let totalMonths = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
      if (now.getDate() < dob.getDate()) totalMonths--;
      return totalMonths <= 0 ? '<1 month' : `${totalMonths} month${totalMonths === 1 ? '' : 's'}`;
    }
    return `${years}y ${months}m`;
  }

  function ageInMonths(dobStr) {
    if (!dobStr) return null;
    const dob = new Date(dobStr);
    if (isNaN(dob.getTime())) return null;
    const now = new Date();
    let totalMonths = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
    if (now.getDate() < dob.getDate()) totalMonths--;
    return totalMonths;
  }

  function round(n, dp = 1) {
    const f = Math.pow(10, dp);
    return Math.round(n * f) / f;
  }

  function esc(str) {
    if (str === undefined || str === null) return '';
    return String(str);
  }

  // ---------- generic field collections (all elements with id) ----------
  const TEXT_IDS = [
    'p_name','p_dob','p_weight',
    'e_date','e_time','e_duration','e_witness_desc','e_aura_desc','e_postictal_duration',
    'c_temp','c_headinjury_details','c_illness_details','c_provoking_details',
    'h_priorseizures_details','h_famepilepsy_details','h_devhistory_details','h_medications',
    'gcs_e','gcs_v','gcs_m','x_temp','x_hr','x_rr','x_bp','x_spo2','x_glucose',
    'x_focalsigns_details','x_headcirc','x_headcirc_percentile',
    'i_bm','i_na','i_k','i_ca','i_mg','i_glucose_result','i_lactate',
    'i_lp_reason','i_csf_wcc','i_csf_protein','i_csf_glucose','i_csf_organisms','i_csf_pressure',
    'i_ct_rationale','i_ecg_result',
    'f_neuroappt_timeframe','m_clinician','m_seniorreview'
  ];
  const SELECT_IDS = ['p_gender','p_referral','e_hemiside','i_mri_urgency','m_disposition'];
  const RADIO_NAMES = [
    'e_onset','e_eyes','e_eyedirection','e_automatisms','e_incontinence','e_tonguebite','e_tonguebite_where',
    'e_colour','e_loc','e_lvlconsciousness','e_focalfeatures','e_aura','e_trainedwitness',
    'c_febrile','c_febrile_type','c_headinjury','c_illness','c_sleepdep','c_substance','c_metabolic',
    'c_medchange','c_stress','c_awakestate','c_provoking',
    'h_priorseizures','h_famepilepsy','h_famfebrile','h_devhistory','h_milestones','h_immunisations',
    'x_postictalnow','x_mentalstatus','x_appearance','x_dysmorphic','x_focalsigns','x_cranialnerve',
    'x_cerebellar','x_motor','x_reflexes',
    'i_urinedip','i_lp_indicated','i_lp_performed','i_ct_indicated','i_mri_requested','i_ecg',
    'class_type',
    'm_activemgmt','m_glucosegiven','m_abxgiven','r_neuroreferral','r_neuroreferral_urgency','r_picu',
    'r_childprotection','m_drivingadvice','sn_writteninfo','sn_leaflet','f_gpinformed','f_neuroappt','f_school'
  ];
  const CHECKBOX_GROUPS = [
    'e_movements','e_postictal','h_birth','h_neurodev','h_pmh','x_skin','x_meningism','x_icp','i_bloods','dc_criteria'
  ];
  const SINGLE_CHECKS = ['i_eeg_recommended'];
  const DRUG_CHECKS = ['drug_midazolam','drug_diazepam','drug_lorazepam','drug_phenytoin','drug_levetiracetam'];

  // ---------- save / load (simple flat object, no wrapper) ----------
  function saveState() {
    const flat = { values: {}, radios: {}, checks: {}, checkboxGroups: {} };
    TEXT_IDS.forEach(id => { const el = getEl(id); if (el) flat.values[id] = el.value; });
    SELECT_IDS.forEach(id => { const el = getEl(id); if (el) flat.values[id] = el.value; });
    RADIO_NAMES.forEach(name => {
      const checked = document.querySelector(`input[name="${name}"]:checked`);
      flat.radios[name] = checked ? checked.value : '';
    });
    CHECKBOX_GROUPS.forEach(name => {
      flat.checkboxGroups[name] = Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(el => el.value);
    });
    SINGLE_CHECKS.forEach(id => { const el = getEl(id); if (el) flat.checks[id] = el.checked; });
    DRUG_CHECKS.forEach(id => { const el = getEl(id); if (el) flat.checks[id] = el.checked; });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(flat)); } catch (e) { /* ignore quota errors */ }
    flashSaved();
  }

  let saveFlashTimer = null;
  function flashSaved() {
    const el = getEl('saveStatus');
    if (!el) return;
    clearTimeout(saveFlashTimer);
    el.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span> Auto-save';
  }

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const flat = JSON.parse(raw);
      if (flat.values) Object.keys(flat.values).forEach(id => { const el = getEl(id); if (el && flat.values[id] !== undefined) el.value = flat.values[id]; });
      if (flat.radios) Object.keys(flat.radios).forEach(name => {
        const v = flat.radios[name];
        if (!v) return;
        const el = document.querySelector(`input[name="${name}"][value="${cssEscape(v)}"]`);
        if (el) el.checked = true;
      });
      if (flat.checkboxGroups) Object.keys(flat.checkboxGroups).forEach(name => {
        (flat.checkboxGroups[name] || []).forEach(v => {
          const el = document.querySelector(`input[name="${name}"][value="${cssEscape(v)}"]`);
          if (el) el.checked = true;
        });
      });
      if (flat.checks) Object.keys(flat.checks).forEach(id => { const el = getEl(id); if (el) el.checked = !!flat.checks[id]; });
    } catch (e) { console.error('Failed to load saved data', e); }
  }

  function cssEscape(str) {
    return String(str).replace(/["\\]/g, '\\$&');
  }

  // ---------- conditional visibility wiring ----------
  function wireConditional(radioName, value, containerId) {
    document.querySelectorAll(`input[name="${radioName}"]`).forEach(r => {
      r.addEventListener('change', () => {
        const show = document.querySelector(`input[name="${radioName}"]:checked`)?.value === value;
        const el = getEl(containerId);
        if (el) el.classList.toggle('hidden', !show);
      });
    });
  }

  wireConditional('e_eyes', 'Deviated', 'e_eyedeviation_container');
  wireConditional('e_tonguebite', 'Yes', 'e_tonguebite_where_container');
  wireConditional('e_focalfeatures', 'Yes', 'e_hemiside_container');
  wireConditional('e_aura', 'Yes', 'e_aura_desc_container');
  wireConditional('c_headinjury', 'Yes', 'c_headinjury_details_container');
  wireConditional('c_illness', 'Yes', 'c_illness_details_container');
  wireConditional('c_provoking', 'Yes', 'c_provoking_details_container');
  wireConditional('h_priorseizures', 'Yes', 'h_priorseizures_details_container');
  wireConditional('h_famepilepsy', 'Yes', 'h_famepilepsy_details_container');
  wireConditional('x_focalsigns', 'Yes', 'x_focalsigns_details_container');
  wireConditional('i_mri_requested', 'Yes', 'i_mri_urgency_container');
  wireConditional('r_neuroreferral', 'Yes', 'r_neuroreferral_urgency_container');
  wireConditional('f_neuroappt', 'Yes', 'f_neuroappt_timeframe_container');
  wireConditional('m_activemgmt', 'Yes', 'm_activemgmt_container');

  // developmental delay/regression details
  document.querySelectorAll('input[name="h_devhistory"]').forEach(r => r.addEventListener('change', () => {
    const val = document.querySelector('input[name="h_devhistory"]:checked')?.value;
    getEl('h_devhistory_details_container').classList.toggle('hidden', !(val === 'Delay' || val === 'Regression'));
  }));

  // LP reason shows if No or Deferred
  document.querySelectorAll('input[name="i_lp_indicated"]').forEach(r => r.addEventListener('change', () => {
    const val = document.querySelector('input[name="i_lp_indicated"]:checked')?.value;
    getEl('i_lp_reason_container').classList.toggle('hidden', !(val === 'No' || val === 'Deferred'));
  }));

  // febrile temp + febrile type + convulsion note
  document.querySelectorAll('input[name="c_febrile"]').forEach(r => r.addEventListener('change', updateFebrileVisibility));
  getEl('p_dob') && getEl('p_dob').addEventListener('input', updateFebrileVisibility);

  function updateFebrileVisibility() {
    const febrile = document.querySelector('input[name="c_febrile"]:checked')?.value;
    getEl('c_temp_container').classList.toggle('hidden', febrile !== 'Yes');
    getEl('c_febrile_type_container').classList.toggle('hidden', febrile !== 'Yes');
    const months = ageInMonths(getEl('p_dob').value);
    const inRange = months !== null && months >= 6 && months <= 60;
    getEl('febrile_convulsion_note').classList.toggle('hidden', !(febrile === 'Yes' && inRange));
  }

  // ---------- age calc ----------
  getEl('p_dob').addEventListener('input', () => {
    getEl('p_age').value = calcAge(getEl('p_dob').value);
    updateNotes();
  });

  // ---------- seizure duration flag ----------
  getEl('e_duration').addEventListener('input', () => {
    const v = parseFloat(getEl('e_duration').value);
    getEl('e_duration_flag').classList.toggle('hidden', !(!isNaN(v) && v > 5));
    updateNotes();
  });

  // ---------- GCS total ----------
  function updateGCS() {
    const e = parseInt(getEl('gcs_e').value);
    const v = parseInt(getEl('gcs_v').value);
    const m = parseInt(getEl('gcs_m').value);
    if (!isNaN(e) && !isNaN(v) && !isNaN(m)) {
      getEl('gcs_total').value = e + v + m;
    } else {
      getEl('gcs_total').value = '';
    }
  }
  ['gcs_e','gcs_v','gcs_m'].forEach(id => getEl(id).addEventListener('input', () => { updateGCS(); updateNotes(); }));

  // ---------- glucose flag ----------
  getEl('x_glucose').addEventListener('input', () => {
    const v = parseFloat(getEl('x_glucose').value);
    const flagEl = getEl('x_glucose_flag');
    if (isNaN(v)) { flagEl.classList.add('hidden'); return; }
    if (v < 3.5) { flagEl.textContent = '⚠ HYPOGLYCAEMIA'; flagEl.classList.remove('hidden'); }
    else if (v > 15) { flagEl.textContent = '⚠ HYPERGLYCAEMIA'; flagEl.classList.remove('hidden'); }
    else { flagEl.classList.add('hidden'); }
    updateNotes();
  });

  // ---------- drug dose calculations ----------
  function updateDoses() {
    const wt = parseFloat(getEl('p_weight').value);
    const setDose = (id, text) => { const el = getEl(id); if (el) el.textContent = text; };
    if (!wt || isNaN(wt) || wt <= 0) {
      ['dose_midazolam','dose_lorazepam','dose_phenytoin','dose_levetiracetam','dose_dextrose','dose_ceftriaxone'].forEach(id => setDose(id, ''));
      return;
    }
    const midaz = Math.min(wt * 0.2, 10);
    const loraz = Math.min(wt * 0.1, 4);
    const phenytoin = Math.min(wt * 20, 1000);
    const leveti = Math.min(wt * 40, 3000);
    const dextrose = wt * 2;
    const ceftri = Math.min(wt * 80, 4000);
    setDose('dose_midazolam', `≈ ${round(midaz,1)} mg`);
    setDose('dose_lorazepam', `≈ ${round(loraz,2)} mg`);
    setDose('dose_phenytoin', `≈ ${round(phenytoin,0)} mg`);
    setDose('dose_levetiracetam', `≈ ${round(leveti,0)} mg`);
    setDose('dose_dextrose', `≈ ${round(dextrose,1)} ml (10% dextrose)`);
    setDose('dose_ceftriaxone', `≈ ${round(ceftri,0)} mg`);
  }
  getEl('p_weight').addEventListener('input', () => { updateDoses(); updateNotes(); });

  // ---------- red flags ----------
  function computeRedFlags() {
    const flags = [];
    // Meningism
    const meningism = Array.from(document.querySelectorAll('input[name="x_meningism"]:checked')).map(e => e.value);
    if (meningism.length) flags.push(`Meningism present (${meningism.join(', ')}) — consider LP / antibiotics`);
    // prolonged seizure >30 min -> status epilepticus
    const dur = parseFloat(getEl('e_duration').value);
    if (!isNaN(dur) && dur > 30) flags.push('Prolonged seizure >30 minutes (status epilepticus)');
    // focal neurology not resolved
    const focal = document.querySelector('input[name="x_focalsigns"]:checked')?.value;
    if (focal === 'Yes') flags.push('Focal neurology present / not resolved');
    // Raised ICP
    const icp = Array.from(document.querySelectorAll('input[name="x_icp"]:checked')).map(e => e.value);
    if (icp.length) flags.push(`Raised ICP signs (${icp.join(', ')})`);
    // Age <6 months
    const months = ageInMonths(getEl('p_dob').value);
    if (months !== null && months < 6) flags.push('Age <6 months');
    // abnormal glucose
    const glu = parseFloat(getEl('x_glucose').value);
    if (!isNaN(glu) && (glu < 3.5 || glu > 15)) flags.push(`Abnormal glucose (${glu} mmol/L)`);
    if (document.querySelector('input[name="c_metabolic"]:checked')?.value === 'Yes') flags.push('Metabolic disturbance history');
    // petechiae/purpura
    const skin = Array.from(document.querySelectorAll('input[name="x_skin"]:checked')).map(e => e.value);
    if (skin.includes('Petechiae/purpura')) flags.push('Petechiae/purpura — septicaemia until proven otherwise');
    // neurocutaneous signs
    const neurocut = skin.filter(s => ['Café-au-lait spots','Port wine stain','Ash leaf macules','Shagreen patches'].includes(s));
    if (neurocut.length) flags.push(`Neurocutaneous signs present (${neurocut.join(', ')}) — needs neurology referral`);
    // regression of development
    if (document.querySelector('input[name="h_devhistory"]:checked')?.value === 'Regression') flags.push('Regression of development');
    // suspected Dravet (febrile status <12 months)
    const feb = document.querySelector('input[name="c_febrile"]:checked')?.value;
    if (feb === 'Yes' && months !== null && months < 12 && !isNaN(dur) && dur > 30) {
      flags.push('Febrile status epilepticus <12 months — consider Dravet syndrome; AVOID sodium-channel blockers (phenytoin/lamotrigine/carbamazepine)');
    }
    return flags;
  }

  function updateRedFlags() {
    const flags = computeRedFlags();
    const displayEl = getEl('redflags_display');
    const bannerEl = getEl('redFlagBanner');
    const listEl = getEl('redFlagList');
    if (flags.length) {
      displayEl.innerHTML = flags.map(f => `<div class="alert-box">⚠ ${esc(f)}</div>`).join('');
      bannerEl && bannerEl.classList.add('show');
      if (listEl) listEl.innerHTML = flags.map(f => `<li>${esc(f)}</li>`).join('');
    } else {
      displayEl.innerHTML = '<p class="text-sm text-slate-400 italic">No red flags currently identified.</p>';
      bannerEl && bannerEl.classList.remove('show');
      if (listEl) listEl.innerHTML = '';
    }
    return flags;
  }

  // ---------- recurrence risk ----------
  function updateRecurrenceRisk() {
    const type = document.querySelector('input[name="class_type"]:checked')?.value;
    const box = getEl('recurrence_risk_box');
    if (!type) { box.classList.add('hidden'); return ''; }
    let text = '';
    if (type === 'Febrile convulsion - simple') text = 'Simple febrile convulsion: ~30% risk of further febrile convulsions; very low risk of subsequent epilepsy.';
    else if (type === 'Febrile convulsion - complex') text = 'Complex febrile convulsion: higher risk of further febrile convulsions and modestly increased epilepsy risk versus simple febrile convulsions.';
    else if (type === 'Unprovoked first seizure') text = 'Unprovoked first seizure: approximately 40% risk of recurrence at 2 years (higher if EEG abnormal or family history of epilepsy).';
    else if (type === 'Provoked seizure (clear cause identified)') text = 'Provoked seizure: recurrence risk depends on treatment of the underlying cause; less likely to recur once cause addressed.';
    else if (type === 'Suspected epilepsy') text = 'Suspected epilepsy (unrecognised prior events): higher recurrence risk — early treatment may be considered, especially if neurology/EEG abnormal.';
    else if (type === 'Status epilepticus') text = 'Status epilepticus: high acuity presentation — recurrence risk depends on underlying aetiology; requires urgent neurology input.';
    else if (type === 'Syncope / non-epileptic event') text = 'Syncope / non-epileptic event: recurrence risk relates to underlying cardiac/vasovagal/psychogenic aetiology, not epilepsy.';
    if (text) { box.textContent = text; box.classList.remove('hidden'); } else { box.classList.add('hidden'); }
    return text;
  }
  document.querySelectorAll('input[name="class_type"]').forEach(r => r.addEventListener('change', () => { updateRecurrenceRisk(); updateNotes(); }));

  // ---------- EPR note generation ----------
  function listVal(name) { return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(e => e.value); }
  function radVal(name) { return document.querySelector(`input[name="${name}"]:checked`)?.value || ''; }
  function val(id) { const el = getEl(id); return el ? el.value : ''; }

  function updateNotes() {
    const noteTime = new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    updateDoses();
    const flags = updateRedFlags();
    const recurrenceText = updateRecurrenceRisk();

    let h = `<b>PAEDIATRIC FIRST SEIZURE ASSESSMENT</b> <span style="color:#64748b;">[${noteTime}]</span><br><br>`;

    // Patient details
    h += `<b>Patient Details</b><br>`;
    h += `Name: ${esc(val('p_name'))} | DOB: ${esc(val('p_dob'))} | Age: ${esc(val('p_age'))} | Weight: ${esc(val('p_weight'))} kg | Gender: ${esc(val('p_gender'))}<br>`;
    h += `Accompanied by / witness: ${esc(val('p_accompanied'))} | Referral source: ${esc(val('p_referral'))}<br><br>`;

    // Event description
    h += `<b>Event Description</b><br>`;
    h += `Date/Time of seizure: ${esc(val('e_date'))} ${esc(val('e_time'))}<br>`;
    const dur = val('e_duration');
    h += `Duration: ${esc(dur)} min${(!isNaN(parseFloat(dur)) && parseFloat(dur) > 5) ? ' <b style="color:#dc2626;">(PROLONGED &gt;5 min)</b>' : ''}<br>`;
    h += `Onset type: ${esc(radVal('e_onset'))}<br>`;
    const movements = listVal('e_movements');
    if (movements.length) h += `Movements/behaviour (2021 ILAE classification): ${esc(movements.join(', '))}<br>`;
    if (val('e_witness_desc')) h += `Witness description: ${esc(val('e_witness_desc'))}<br>`;
    let eyes = radVal('e_eyes');
    if (eyes === 'Deviated') eyes += ` (${esc(radVal('e_eyedirection'))})`;
    h += `Eyes: ${esc(eyes)}<br>`;
    h += `Automatisms: ${esc(radVal('e_automatisms'))} | Incontinence: ${esc(radVal('e_incontinence'))} | Tongue biting: ${esc(radVal('e_tonguebite'))}${radVal('e_tonguebite')==='Yes' ? ' ('+esc(radVal('e_tonguebite_where'))+')' : ''}<br>`;
    h += `Colour change: ${esc(radVal('e_colour'))} | Loss of consciousness: ${esc(radVal('e_loc'))} | Level of consciousness during: ${esc(radVal('e_lvlconsciousness'))}<br>`;
    h += `Post-ictal duration: ${esc(val('e_postictal_duration'))} min`;
    const postictal = listVal('e_postictal');
    if (postictal.length) h += ` — Features: ${esc(postictal.join(', '))}`;
    h += `<br>`;
    let focal = radVal('e_focalfeatures');
    if (focal === 'Yes') focal += ` (${esc(val('e_hemiside'))})`;
    h += `Focal features suggesting focal onset: ${esc(focal)}<br>`;
    let aura = radVal('e_aura');
    if (aura === 'Yes' && val('e_aura_desc')) aura += ` — ${esc(val('e_aura_desc'))}`;
    h += `Prior aura: ${esc(aura)}<br>`;
    h += `Witnessed by trained observer: ${esc(radVal('e_trainedwitness'))}<br>`;
    h += `<i>Smartphone video of suspected epileptic event is crucial for robust diagnosis — reviewed if available.</i><br><br>`;

    // Preceding circumstances
    h += `<b>Preceding Circumstances</b><br>`;
    let febrileLine = `Febrile at time: ${esc(radVal('c_febrile'))}`;
    if (radVal('c_febrile') === 'Yes') {
      febrileLine += ` (Temp ${esc(val('c_temp'))}°C)`;
      if (radVal('c_febrile_type')) febrileLine += ` — ${esc(radVal('c_febrile_type'))} febrile seizure`;
      const months = ageInMonths(val('p_dob'));
      if (months !== null && months >= 6 && months <= 60) febrileLine += ` <b style="color:#b45309;">[CONSIDER FEBRILE CONVULSION]</b>`;
    }
    h += febrileLine + `<br>`;
    let hi = radVal('c_headinjury'); if (hi === 'Yes' && val('c_headinjury_details')) hi += ` — ${esc(val('c_headinjury_details'))}`;
    h += `Recent head injury: ${esc(hi)}<br>`;
    let ill = radVal('c_illness'); if (ill === 'Yes' && val('c_illness_details')) ill += ` — ${esc(val('c_illness_details'))}`;
    h += `Recent illness/infection: ${esc(ill)}<br>`;
    h += `Sleep deprived: ${esc(radVal('c_sleepdep'))} | Alcohol/drug use: ${esc(radVal('c_substance'))} | Metabolic disturbance history: ${esc(radVal('c_metabolic'))}<br>`;
    h += `Medication change/missed dose: ${esc(radVal('c_medchange'))} | Emotional stress: ${esc(radVal('c_stress'))}<br>`;
    h += `Awake/asleep at onset: ${esc(radVal('c_awakestate'))}<br>`;
    let prov = radVal('c_provoking'); if (prov === 'Yes' && val('c_provoking_details')) prov += ` — ${esc(val('c_provoking_details'))}`;
    h += `Provoking factor identified: ${esc(prov)}<br><br>`;

    // History
    h += `<b>Relevant History</b><br>`;
    let priorSz = radVal('h_priorseizures'); if (priorSz === 'Yes' && val('h_priorseizures_details')) priorSz += ` — ${esc(val('h_priorseizures_details'))}`;
    h += `Previous possible seizure events: ${esc(priorSz)}<br>`;
    let famEp = radVal('h_famepilepsy'); if (famEp === 'Yes' && val('h_famepilepsy_details')) famEp += ` — ${esc(val('h_famepilepsy_details'))}`;
    h += `Family history epilepsy: ${esc(famEp)} | Family history febrile convulsions: ${esc(radVal('h_famfebrile'))}<br>`;
    const birth = listVal('h_birth');
    if (birth.length) h += `Birth history: ${esc(birth.join(', '))}<br>`;
    let dev = radVal('h_devhistory'); if ((dev === 'Delay' || dev === 'Regression') && val('h_devhistory_details')) dev += ` — ${esc(val('h_devhistory_details'))}`;
    h += `Developmental history: ${esc(dev)} | Milestones: ${esc(radVal('h_milestones'))}<br>`;
    const neurodev = listVal('h_neurodev');
    if (neurodev.length) h += `Neurodevelopmental diagnosis: ${esc(neurodev.join(', '))}<br>`;
    const pmh = listVal('h_pmh');
    if (pmh.length) h += `PMH: ${esc(pmh.join(', '))}<br>`;
    if (val('h_medications')) h += `Current medications: ${esc(val('h_medications'))}<br>`;
    h += `Immunisations up to date: ${esc(radVal('h_immunisations'))}<br><br>`;

    // Examination
    h += `<b>Examination</b><br>`;
    const gcsTotal = val('gcs_total');
    h += `GCS: E${esc(val('gcs_e'))} V${esc(val('gcs_v'))} M${esc(val('gcs_m'))}${gcsTotal ? ` = ${esc(gcsTotal)}` : ''}<br>`;
    h += `Currently post-ictal: ${esc(radVal('x_postictalnow'))} | Current mental status: ${esc(radVal('x_mentalstatus'))}<br>`;
    h += `Temp ${esc(val('x_temp'))}°C | HR ${esc(val('x_hr'))} | RR ${esc(val('x_rr'))} | BP ${esc(val('x_bp'))} | SpO2 ${esc(val('x_spo2'))}%`;
    const glu = parseFloat(val('x_glucose'));
    let gluStr = val('x_glucose');
    if (!isNaN(glu)) { if (glu < 3.5) gluStr += ' mmol/L <b style="color:#dc2626;">(HYPOGLYCAEMIA)</b>'; else if (glu > 15) gluStr += ' mmol/L <b style="color:#dc2626;">(HYPERGLYCAEMIA)</b>'; else gluStr += ' mmol/L'; }
    h += ` | Glucose ${gluStr}<br>`;
    h += `General appearance: ${esc(radVal('x_appearance'))}<br>`;
    const skin = listVal('x_skin');
    if (skin.length) h += `Skin: ${esc(skin.join(', '))}<br>`;
    h += `Dysmorphic features: ${esc(radVal('x_dysmorphic'))}<br>`;
    const meningism = listVal('x_meningism');
    if (meningism.length) h += `<b style="color:#dc2626;">Meningism: ${esc(meningism.join(', '))}</b><br>`;
    const icp = listVal('x_icp');
    if (icp.length) h += `<b style="color:#dc2626;">Raised ICP signs: ${esc(icp.join(', '))}</b><br>`;
    let focalSigns = radVal('x_focalsigns'); if (focalSigns === 'Yes' && val('x_focalsigns_details')) focalSigns += ` — ${esc(val('x_focalsigns_details'))}`;
    h += `Focal neurological signs: ${esc(focalSigns)} | Cranial nerve abnormality: ${esc(radVal('x_cranialnerve'))}<br>`;
    h += `Motor exam: ${esc(radVal('x_motor'))} | Reflexes: ${esc(radVal('x_reflexes'))} | Cerebellar signs: ${esc(radVal('x_cerebellar'))}<br>`;
    if (val('x_headcirc')) h += `Head circumference: ${esc(val('x_headcirc'))} cm${val('x_headcirc_percentile') ? ' ('+esc(val('x_headcirc_percentile'))+')' : ''}<br>`;
    h += `<br>`;

    // Investigations
    h += `<b>Investigations</b><br>`;
    h += `BM: ${esc(val('i_bm'))} mmol/L | Urine dip: ${esc(radVal('i_urinedip'))}<br>`;
    const bloods = listVal('i_bloods');
    if (bloods.length) h += `Bloods ordered: ${esc(bloods.join(', '))}<br>`;
    const results = [];
    if (val('i_na')) results.push(`Na ${esc(val('i_na'))}`);
    if (val('i_k')) results.push(`K ${esc(val('i_k'))}`);
    if (val('i_ca')) results.push(`Ca ${esc(val('i_ca'))}`);
    if (val('i_mg')) results.push(`Mg ${esc(val('i_mg'))}`);
    if (val('i_glucose_result')) results.push(`Glucose ${esc(val('i_glucose_result'))}`);
    if (val('i_lactate')) results.push(`Lactate ${esc(val('i_lactate'))}`);
    if (results.length) h += `Results: ${results.join(', ')}<br>`;
    let lp = radVal('i_lp_indicated'); if ((lp === 'No' || lp === 'Deferred') && val('i_lp_reason')) lp += ` (${esc(val('i_lp_reason'))})`;
    h += `LP indicated: ${esc(lp)} | Performed: ${esc(radVal('i_lp_performed'))}`;
    if (radVal('i_lp_performed') === 'Yes') {
      const csf = [];
      if (val('i_csf_wcc')) csf.push(`WCC ${esc(val('i_csf_wcc'))}`);
      if (val('i_csf_protein')) csf.push(`Protein ${esc(val('i_csf_protein'))}`);
      if (val('i_csf_glucose')) csf.push(`Glucose ${esc(val('i_csf_glucose'))}`);
      if (val('i_csf_organisms')) csf.push(`Organisms ${esc(val('i_csf_organisms'))}`);
      if (val('i_csf_pressure')) csf.push(`Opening pressure ${esc(val('i_csf_pressure'))}`);
      if (csf.length) h += ` — CSF: ${csf.join(', ')}`;
    }
    h += `<br>`;
    let ct = radVal('i_ct_indicated'); if (val('i_ct_rationale')) ct += ` — ${esc(val('i_ct_rationale'))}`;
    h += `CT head indicated: ${esc(ct)} (NICE: not routine after first seizure if exam normal; urgent CT if focal neurology, raised ICP, head injury, immunocompromised, or not returned to baseline)<br>`;
    let mri = radVal('i_mri_requested'); if (mri === 'Yes' && val('i_mri_urgency')) mri += ` (${esc(val('i_mri_urgency'))})`;
    h += `MRI brain requested: ${esc(mri)} (MRI preferred over CT — organise within 6 weeks of diagnosis; indicated in ALL children UNLESS idiopathic generalised epilepsy OR SeLECTS with complete seizure control on first-line medication)<br>`;
    h += `ECG performed: ${esc(radVal('i_ecg'))}${val('i_ecg_result') ? ' — '+esc(val('i_ecg_result')) : ''}<br>`;
    h += `EEG: ${getEl('i_eeg_recommended').checked ? 'Recommended (routine, outpatient)' : 'Not indicated at this time'} — <b>EEG NOT routinely indicated for a first generalised tonic-clonic seizure</b>; should NOT be performed as an ED emergency; arrange outpatient EEG via paediatric neurology only if a guideline indication is met<br><br>`;

    // Classification
    const classType = radVal('class_type');
    h += `<b>Classification</b>: ${esc(classType) || 'Not yet classified'}<br>`;
    if (recurrenceText) h += `<b>Recurrence risk</b>: ${esc(recurrenceText)}<br>`;
    h += `<br>`;

    // Red flags
    h += `<b>Red Flags</b>: `;
    h += flags.length ? `<b style="color:#dc2626;">PRESENT</b> — ${esc(flags.join('; '))}` : 'None identified';
    h += `<br><br>`;

    // Management
    h += `<b>Management</b><br>`;
    h += `Active seizure management required: ${esc(radVal('m_activemgmt'))}<br>`;
    if (radVal('m_activemgmt') === 'Yes') {
      const drugsGiven = [];
      if (getEl('drug_midazolam').checked) drugsGiven.push(`Buccal midazolam${getEl('dose_midazolam').textContent ? ' '+getEl('dose_midazolam').textContent : ''}`);
      if (getEl('drug_diazepam').checked) drugsGiven.push('Rectal diazepam');
      if (getEl('drug_lorazepam').checked) drugsGiven.push(`IV lorazepam${getEl('dose_lorazepam').textContent ? ' '+getEl('dose_lorazepam').textContent : ''}`);
      if (getEl('drug_phenytoin').checked) drugsGiven.push(`IV phenytoin${getEl('dose_phenytoin').textContent ? ' '+getEl('dose_phenytoin').textContent : ''} <b style="color:#dc2626;">(CONTRAINDICATED if suspected Dravet syndrome)</b>`);
      if (getEl('drug_levetiracetam').checked) drugsGiven.push(`IV levetiracetam${getEl('dose_levetiracetam').textContent ? ' '+getEl('dose_levetiracetam').textContent : ''}`);
      if (drugsGiven.length) h += `Medications given: ${drugsGiven.join(', ')}<br>`;
    }
    h += `Blood glucose given: ${esc(radVal('m_glucosegiven'))}${radVal('m_glucosegiven') === 'Yes' && getEl('dose_dextrose').textContent ? ' — Dextrose 10% '+getEl('dose_dextrose').textContent : ''}<br>`;
    h += `Antibiotics given: ${esc(radVal('m_abxgiven'))}${radVal('m_abxgiven') === 'Yes' && getEl('dose_ceftriaxone').textContent ? ' — Ceftriaxone '+getEl('dose_ceftriaxone').textContent : ''}<br>`;
    let neuroRef = radVal('r_neuroreferral'); if (neuroRef === 'Yes' && radVal('r_neuroreferral_urgency')) neuroRef += ` (${esc(radVal('r_neuroreferral_urgency'))})`;
    h += `Paediatric neurology referral: ${esc(neuroRef)} | PICU involvement: ${esc(radVal('r_picu'))} | Child protection concern: ${esc(radVal('r_childprotection'))}<br><br>`;

    // Disposition
    const dcCriteria = listVal('dc_criteria');
    h += `<b>Disposition</b>: ${esc(val('m_disposition')) || 'Not yet determined'}<br>`;
    if (dcCriteria.length) h += `Discharge criteria met: ${esc(dcCriteria.join(', '))}<br>`;
    h += `Driving/cycling advice given (if age &gt;16): ${esc(radVal('m_drivingadvice'))}<br>`;
    h += `Safety netting: call 999 if seizure &gt;5min, another seizure, not waking up, or focal features. Written information given: ${esc(radVal('sn_writteninfo'))}. RCPCH/Epilepsy Action leaflet given: ${esc(radVal('sn_leaflet'))}<br>`;
    let neuroAppt = radVal('f_neuroappt'); if (neuroAppt === 'Yes' && val('f_neuroappt_timeframe')) neuroAppt += ` (${esc(val('f_neuroappt_timeframe'))})`;
    h += `Follow-up: GP informed: ${esc(radVal('f_gpinformed'))} | Paeds neurology appt arranged: ${esc(neuroAppt)} | School notification: ${esc(radVal('f_school'))}<br>`;
    h += `Responsible clinician: ${esc(val('m_clinician'))} | Senior review: ${esc(val('m_seniorreview'))}<br>`;

    getEl('epr-output').innerHTML = h;
    saveState();
  }

  // ---------- print ----------
  getEl('btnPrint').addEventListener('click', () => window.print());

  // ---------- reset ----------
  getEl('btnReset').addEventListener('click', () => {
    if (confirm('Reset form? All data will be lost.')) {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  });

  // ---------- global listeners: bind everything to updateNotes ----------
  document.querySelectorAll('input, textarea, select').forEach(el => {
    const evt = (el.tagName === 'SELECT' || el.type === 'radio' || el.type === 'checkbox') ? 'change' : 'input';
    el.addEventListener(evt, updateNotes);
  });

  // ---------- init ----------
  loadState();
  updateGCS();
  getEl('p_age').value = calcAge(getEl('p_dob').value);
  updateFebrileVisibility();
  updateDoses();
  updateNotes();
});
