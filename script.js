
function copyRichText() {
    var el = document.getElementById('epr-output');
    if (!el) return;
    var htmlContent = el.innerHTML;
    var plainText = el.innerText;
    var copyBtn = document.getElementById('copy-rich-text-btn');
    function flashBtn(ok) {
        if (!copyBtn) return;
        var orig = copyBtn.textContent;
        copyBtn.textContent = ok ? '\u2713 Copied!' : 'Copy failed';
        copyBtn.style.background = ok ? '#16a34a' : '#dc2626';
        setTimeout(function() {
            copyBtn.textContent = orig;
            copyBtn.style.background = '';
        }, 1500);
    }
    if (navigator.clipboard && window.ClipboardItem) {
        navigator.clipboard.write([
            new ClipboardItem({
                'text/html':  new Blob([htmlContent], { type: 'text/html' }),
                'text/plain': new Blob([plainText],  { type: 'text/plain' })
            })
        ]).then(function() { flashBtn(true); })
          .catch(function() {
            navigator.clipboard.writeText(plainText)
                .then(function() { flashBtn(true); })
                .catch(function() { flashBtn(false); });
        });
    } else if (navigator.clipboard) {
        navigator.clipboard.writeText(plainText)
            .then(function() { flashBtn(true); })
            .catch(function() { flashBtn(false); });
    } else {
        try {
            var range = document.createRange();
            range.selectNodeContents(el);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            document.execCommand('copy');
            sel.removeAllRanges();
            flashBtn(true);
        } catch(e) { flashBtn(false); }
    }
}

// ---------- copy rich text (exact required implementation, global scope) ----------


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

  function ph(text) {
    return `<span style="color:#94a3b8">[${text || 'not recorded'}]</span>`;
  }
  function fv(v, placeholder) {
    return (v !== undefined && v !== null && v !== '') ? esc(v) : ph(placeholder);
  }
  function heading(text) {
    return `<b style="font-weight:bold;">${text}</b><br>`;
  }

  function updateNotes() {
    const noteTime = new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    updateDoses();
    const flags = updateRedFlags();
    const recurrenceText = updateRecurrenceRisk();

    let h = `<b style="font-weight:bold;">PAEDIATRIC FIRST SEIZURE ASSESSMENT</b> <span style="color:#64748b;">[${noteTime}]</span><br><br>`;

    // Patient details
    h += heading('PATIENT DETAILS');
    h += `Name: ${fv(val('p_name'))} | DOB: ${fv(val('p_dob'))} | Age: ${fv(val('p_age'))} | Weight: ${val('p_weight') ? esc(val('p_weight')) + ' kg' : ph('not recorded')} | Gender: ${fv(val('p_gender'))}<br>`;
    h += `Accompanied by: ${fv(val('p_accompanied'))} | Referral source: ${fv(val('p_referral'))}<br><br>`;

    // Event description
    h += heading('EVENT DESCRIPTION');
    h += `Date/time of seizure: ${fv(val('e_date'))} ${fv(val('e_time'))} | `;
    const dur = val('e_duration');
    const prolonged = (!isNaN(parseFloat(dur)) && parseFloat(dur) > 5);
    h += `Duration: ${dur ? esc(dur) + ' mins' : ph('not recorded')}${prolonged ? ' <span style="color:#dc2626;font-weight:bold">⚠️ PROLONGED</span>' : ''}<br>`;
    h += `Onset: ${fv(radVal('e_onset'))}<br>`;
    const movements = listVal('e_movements');
    h += `Semiology: ${movements.length ? esc(movements.join(', ')) : ph('not documented')}<br>`;
    let eyes = radVal('e_eyes');
    if (eyes === 'Deviated') eyes += ` (${esc(radVal('e_eyedirection'))})`;
    h += `Eyes: ${fv(eyes)} | Incontinence: ${fv(radVal('e_incontinence'))} | Tongue biting: ${fv(radVal('e_tonguebite'))}${radVal('e_tonguebite')==='Yes' ? ' ('+esc(radVal('e_tonguebite_where'))+')' : ''} | Colour change: ${fv(radVal('e_colour'))}<br>`;
    h += `Consciousness: ${fv(radVal('e_loc'))}${radVal('e_lvlconsciousness') ? ' (' + esc(radVal('e_lvlconsciousness')) + ')' : ''} | Post-ictal duration: ${val('e_postictal_duration') ? esc(val('e_postictal_duration')) + ' mins' : ph('not recorded')}<br>`;
    const postictal = listVal('e_postictal');
    h += `Post-ictal features: ${postictal.length ? esc(postictal.join(', ')) : '<span style="color:#16a34a">Normal rapid recovery</span>'}<br>`;
    let focal = radVal('e_focalfeatures');
    if (focal === 'Yes') focal += ` (${esc(val('e_hemiside'))})`;
    h += `Focal features: ${fv(focal)}<br>`;
    h += `Witnessed by: ${fv(radVal('e_trainedwitness'))}<br>`;
    h += `📱 Smartphone video obtained: ${ph('ask parent/carer — review if available')}<br><br>`;

    // Preceding circumstances
    h += heading('PRECEDING CIRCUMSTANCES');
    const febrile = radVal('c_febrile');
    let febrileLine = `Febrile: ${fv(febrile)}`;
    if (febrile === 'Yes') {
      febrileLine += ` (Temp ${fv(val('c_temp'))}°C)`;
      const months = ageInMonths(val('p_dob'));
      if (months !== null && months >= 6 && months <= 60) febrileLine += ` — <span style="color:#d97706;font-weight:bold">⚠️ CONSIDER FEBRILE CONVULSION</span>`;
    }
    h += febrileLine + `<br>`;
    h += `Febrile seizure type: ${febrile === 'Yes' ? fv(radVal('c_febrile_type')) : ph('not applicable')}<br>`;
    const provokingFactors = [];
    if (radVal('c_headinjury') === 'Yes') provokingFactors.push('Head injury' + (val('c_headinjury_details') ? ' — ' + val('c_headinjury_details') : ''));
    if (radVal('c_illness') === 'Yes') provokingFactors.push('Illness/infection' + (val('c_illness_details') ? ' — ' + val('c_illness_details') : ''));
    if (radVal('c_sleepdep') === 'Yes') provokingFactors.push('Sleep deprivation');
    if (radVal('c_substance') === 'Yes') provokingFactors.push('Alcohol/drug use');
    if (radVal('c_metabolic') === 'Yes') provokingFactors.push('Metabolic disturbance');
    if (radVal('c_medchange') === 'Yes') provokingFactors.push('Medication change/missed dose');
    if (radVal('c_stress') === 'Yes') provokingFactors.push('Emotional stress');
    if (radVal('c_provoking') === 'Yes') provokingFactors.push('Other provoking factor' + (val('c_provoking_details') ? ' — ' + val('c_provoking_details') : ''));
    h += `Provoking factors: ${provokingFactors.length ? esc(provokingFactors.join(', ')) : '<span style="color:#16a34a">None identified</span>'}<br>`;
    h += `Sleep state at onset: ${fv(radVal('c_awakestate'))}<br><br>`;

    // History
    h += heading('HISTORY');
    let priorSz = radVal('h_priorseizures'); if (priorSz === 'Yes' && val('h_priorseizures_details')) priorSz += ` — ${esc(val('h_priorseizures_details'))}`;
    h += `Previous possible seizures: ${fv(priorSz)} | `;
    let famEp = radVal('h_famepilepsy'); if (famEp === 'Yes' && val('h_famepilepsy_details')) famEp += ` — ${esc(val('h_famepilepsy_details'))}`;
    h += `Family history epilepsy: ${fv(famEp)} | Family history FC: ${fv(radVal('h_famfebrile'))}<br>`;
    const birth = listVal('h_birth');
    h += `Birth history: ${birth.length ? esc(birth.join(', ')) : ph('not recorded')} | `;
    let dev = radVal('h_devhistory'); if ((dev === 'Delay' || dev === 'Regression') && val('h_devhistory_details')) dev += ` — ${esc(val('h_devhistory_details'))}`;
    h += `Development: ${fv(dev)}${radVal('h_milestones') ? ' (Milestones: ' + esc(radVal('h_milestones')) + ')' : ''}<br>`;
    const neurodev = listVal('h_neurodev');
    h += `Neurodevelopmental diagnoses: ${neurodev.length ? esc(neurodev.join(', ')) : '<span style="color:#16a34a">None</span>'}<br>`;
    const pmh = listVal('h_pmh');
    h += `Relevant PMH: ${pmh.length ? esc(pmh.join(', ')) : '<span style="color:#16a34a">None relevant</span>'}<br>`;
    h += `Current medications: ${fv(val('h_medications'), 'none recorded')} | Immunisations: ${fv(radVal('h_immunisations'))}<br><br>`;

    // Examination
    h += heading('EXAMINATION');
    const gcsTotal = val('gcs_total');
    h += `GCS: E${fv(val('gcs_e'))} V${fv(val('gcs_v'))} M${fv(val('gcs_m'))} = ${gcsTotal ? esc(gcsTotal) + '/15' : ph('not calculated')} | Post-ictal: ${fv(radVal('x_postictalnow'))}<br>`;
    h += `Conscious level: ${fv(radVal('x_mentalstatus'))} | Temperature: ${fv(val('x_temp'))}°C | HR: ${fv(val('x_hr'))} | RR: ${fv(val('x_rr'))} | SpO2: ${fv(val('x_spo2'))}% | BP: ${fv(val('x_bp'))}<br>`;
    const glu = parseFloat(val('x_glucose'));
    let gluFlag = '';
    if (!isNaN(glu)) {
      if (glu < 3.5) gluFlag = ' <span style="color:#dc2626;font-weight:bold">⚠️ HYPOGLYCAEMIA</span>';
      else if (glu > 15) gluFlag = ' <span style="color:#dc2626;font-weight:bold">⚠️ HYPERGLYCAEMIA</span>';
    }
    h += `Glucose: ${val('x_glucose') ? esc(val('x_glucose')) + ' mmol/L' : ph('not recorded')}${gluFlag}<br>`;
    h += `Appearance: ${fv(radVal('x_appearance'))}<br>`;
    const skin = listVal('x_skin');
    h += `Skin: ${skin.length ? esc(skin.join(', ')) : '<span style="color:#16a34a">No neurocutaneous stigmata</span>'}<br>`;
    h += `Dysmorphic features: ${fv(radVal('x_dysmorphic'))}<br>`;
    const meningism = listVal('x_meningism');
    h += `Meningism: ${meningism.length ? `<span style="color:#dc2626;font-weight:bold">⚠️ RED FLAG: ${esc(meningism.join(', '))}</span>` : '<span style="color:#16a34a">No meningism</span>'}<br>`;
    const icp = listVal('x_icp');
    h += `Raised ICP signs: ${icp.length ? `<span style="color:#dc2626;font-weight:bold">⚠️ ${esc(icp.join(', '))}</span>` : '<span style="color:#16a34a">No signs of raised ICP</span>'}<br>`;
    let focalSigns = radVal('x_focalsigns'); if (focalSigns === 'Yes' && val('x_focalsigns_details')) focalSigns += ` — ${esc(val('x_focalsigns_details'))}`;
    h += `Focal neurology: ${fv(focalSigns)}<br>`;
    h += `Motor exam: ${fv(radVal('x_motor'))} | Reflexes: ${fv(radVal('x_reflexes'))} | Cerebellar: ${fv(radVal('x_cerebellar'))}<br><br>`;

    // Investigations
    h += heading('INVESTIGATIONS');
    h += `Bedside: BM ${fv(val('i_bm'))} mmol/L | Urine dip ${fv(radVal('i_urinedip'))}<br>`;
    const bloods = listVal('i_bloods');
    h += `Bloods ordered: ${bloods.length ? esc(bloods.join(', ')) : ph('none ordered')}<br>`;
    h += `Critical results: Na ${fv(val('i_na'))} | K ${fv(val('i_k'))} | Ca ${fv(val('i_ca'))} | Mg ${fv(val('i_mg'))} | Glucose ${fv(val('i_glucose_result'))} | Lactate ${fv(val('i_lactate'))}<br>`;
    let lp = radVal('i_lp_indicated'); if ((lp === 'No' || lp === 'Deferred') && val('i_lp_reason')) lp += ` (${esc(val('i_lp_reason'))})`;
    let lpLine = `LP: ${fv(lp, 'not indicated')}`;
    if (radVal('i_lp_performed') === 'Yes') {
      const csf = [];
      if (val('i_csf_wcc')) csf.push(`WCC ${esc(val('i_csf_wcc'))}`);
      if (val('i_csf_protein')) csf.push(`Protein ${esc(val('i_csf_protein'))}`);
      if (val('i_csf_glucose')) csf.push(`Glucose ${esc(val('i_csf_glucose'))}`);
      if (val('i_csf_organisms')) csf.push(`Organisms ${esc(val('i_csf_organisms'))}`);
      if (val('i_csf_pressure')) csf.push(`Opening pressure ${esc(val('i_csf_pressure'))}`);
      lpLine += ` — Performed. Findings: ${csf.length ? csf.join(', ') : ph('not recorded')}`;
    }
    h += lpLine + `<br>`;
    let ct = radVal('i_ct_indicated');
    let ctLine = `CT head: ${fv(ct, 'not indicated')}`;
    if (val('i_ct_rationale')) ctLine += ` — ${esc(val('i_ct_rationale'))}`;
    h += ctLine + `<br>`;
    let mri = radVal('i_mri_requested');
    let mriLine = `MRI brain: ${mri === 'Yes' ? 'requested' : fv(mri, 'not yet requested')}`;
    mriLine += ` — urgency: ${mri === 'Yes' ? fv(val('i_mri_urgency')) : ph('n/a')}`;
    h += mriLine + `<br>`;
    h += `&nbsp;&nbsp;NOTE: MRI indicated within 6 weeks unless idiopathic generalised epilepsy or SeLECTS with complete seizure control<br>`;
    h += `ECG: ${fv(radVal('i_ecg'))}${val('i_ecg_result') ? ' — ' + esc(val('i_ecg_result')) : ''}<br>`;
    h += `EEG: <span style="color:#d97706;font-weight:bold">⚠️ EEG NOT routinely indicated for first generalised tonic-clonic seizure</span> — arrange outpatient${getEl('i_eeg_recommended') && getEl('i_eeg_recommended').checked ? ' (recommended)' : ''}<br><br>`;

    // Classification
    h += heading('CLASSIFICATION');
    const classType = radVal('class_type');
    h += `Seizure type: ${fv(classType, 'not yet classified')}<br>`;
    h += recurrenceText ? `${esc(recurrenceText)}<br>` : `${ph('recurrence risk not yet available — classify seizure type above')}<br>`;
    h += `<br>`;

    // Red flags
    h += heading('RED FLAGS');
    h += flags.length ? `<span style="color:#dc2626;font-weight:bold">⚠️ ${esc(flags.join('; '))}</span><br><br>` : `<span style="color:#16a34a">No red flags identified</span><br><br>`;

    // Management
    h += heading('MANAGEMENT');
    const activeMgmt = radVal('m_activemgmt');
    if (activeMgmt === 'Yes') {
      const drugsGiven = [];
      if (getEl('drug_midazolam').checked) drugsGiven.push(`Buccal midazolam${getEl('dose_midazolam').textContent ? ' '+getEl('dose_midazolam').textContent : ''}`);
      if (getEl('drug_diazepam').checked) drugsGiven.push('Rectal diazepam');
      if (getEl('drug_lorazepam').checked) drugsGiven.push(`IV lorazepam${getEl('dose_lorazepam').textContent ? ' '+getEl('dose_lorazepam').textContent : ''}`);
      if (getEl('drug_phenytoin').checked) drugsGiven.push(`IV phenytoin${getEl('dose_phenytoin').textContent ? ' '+getEl('dose_phenytoin').textContent : ''} <span style="color:#dc2626;font-weight:bold">(CONTRAINDICATED if suspected Dravet syndrome)</span>`);
      if (getEl('drug_levetiracetam').checked) drugsGiven.push(`IV levetiracetam${getEl('dose_levetiracetam').textContent ? ' '+getEl('dose_levetiracetam').textContent : ''}`);
      h += `Active seizure treatment: ${drugsGiven.length ? drugsGiven.join(', ') : ph('not recorded')}<br>`;
    } else {
      h += `Active seizure treatment: ${activeMgmt === 'No' ? '<span style="color:#16a34a">No active seizure treatment required</span>' : ph('not recorded')}<br>`;
    }
    const glucGiven = radVal('m_glucosegiven');
    h += `Glucose: ${glucGiven === 'Yes' ? 'given' + (getEl('dose_dextrose').textContent ? ' — Dextrose 10% ' + getEl('dose_dextrose').textContent : '') : fv(glucGiven, 'not required')}<br>`;
    const abxGiven = radVal('m_abxgiven');
    h += `Antibiotics: ${abxGiven === 'Yes' ? 'given' + (getEl('dose_ceftriaxone').textContent ? ' — Ceftriaxone ' + getEl('dose_ceftriaxone').textContent : '') : fv(abxGiven, 'not required')}<br>`;
    let neuroRef = radVal('r_neuroreferral'); if (neuroRef === 'Yes' && radVal('r_neuroreferral_urgency')) neuroRef += ` (${esc(radVal('r_neuroreferral_urgency'))})`;
    h += `Referral: Paediatric neurology ${fv(neuroRef)} | PICU: ${fv(radVal('r_picu'))}<br>`;
    h += `Child protection concern: ${fv(radVal('r_childprotection'))}<br><br>`;

    // Disposition
    h += heading('DISPOSITION');
    const dcCriteria = listVal('dc_criteria');
    h += `Discharge criteria: ${dcCriteria.length ? esc(dcCriteria.join(', ')) : ph('not yet assessed')}<br>`;
    h += `Disposition: ${fv(val('m_disposition'), 'not yet determined')}<br>`;
    h += `Safety netting provided: ${fv(radVal('sn_writteninfo'))} | Written information: ${fv(radVal('sn_leaflet'))}<br>`;
    let neuroAppt = radVal('f_neuroappt'); if (neuroAppt === 'Yes' && val('f_neuroappt_timeframe')) neuroAppt += ` (${esc(val('f_neuroappt_timeframe'))})`;
    h += `Follow-up: GP informed ${fv(radVal('f_gpinformed'))} | Neurology appt ${fv(neuroAppt)} | School notification ${fv(radVal('f_school'))}<br>`;
    h += `Responsible clinician: ${fv(val('m_clinician'))} | Senior review: ${fv(val('m_seniorreview'))}<br>`;

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
