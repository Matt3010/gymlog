import { expect, type Locator, type Page, test } from '@playwright/test';

/*
 * The MVP as someone uses it at the gym, on a phone: exercises, a plan with
 * two days, a workout logged set by set, the next one showing the last time,
 * and the numbers in the stats. Along the way, what a fake DOM cannot see:
 * the page's last buttons clear of the tab bar, and a message never on top
 * of them.
 */

test.skip(!process.env.E2E_DATABASE_URL, 'needs E2E_DATABASE_URL, like the backend database tests');

const base = () => process.env.E2E_BASE_URL!;

/** Where the tab bar starts, from the top of the window. */
async function tabBarTop(page: Page): Promise<number> {
  return (await page.getByRole('navigation', { name: 'Sezioni' }).boundingBox())!.y;
}

async function scrollToEnd(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForFunction(() => Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 1);
}

/** Each of these whole on screen, above the tab bar. */
async function expectClearOfTabBar(page: Page, ...buttons: Locator[]): Promise<void> {
  const top = await tabBarTop(page);
  for (const button of buttons) {
    const box = (await button.boundingBox())!;
    expect(box.y, `${await button.textContent()} starts on screen`).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, `${await button.textContent()} ends above the tab bar`).toBeLessThanOrEqual(top);
  }
}

/** Something floating (the message, the rest bar), while showing, covers none of these. */
async function expectUncovered(page: Page, floating: Locator, ...buttons: Locator[]): Promise<void> {
  const over = (await floating.boundingBox())!;
  for (const button of buttons) {
    const box = (await button.boundingBox())!;
    const overlap = box.y < over.y + over.height && over.y < box.y + box.height && box.x < over.x + over.width && over.x < box.x + box.width;
    expect(overlap, `${await floating.getAttribute('aria-label') ?? 'the message'} covers ${await button.textContent()}`).toBe(false);
  }
}

const expectToastClearOf = (page: Page, ...buttons: Locator[]) => expectUncovered(page, page.locator('#toast'), ...buttons);

/** One level of card: whatever sits in a card as a row has no background, border or shadow of its own. */
async function expectFlatRows(page: Page): Promise<void> {
  const nested = await page.locator('.card .row, .card .day').evaluateAll((rows) =>
    rows
      .map((row) => {
        const style = getComputedStyle(row);
        const own = style.backgroundColor !== 'rgba(0, 0, 0, 0)' || style.boxShadow !== 'none' || ['Top', 'Left', 'Right'].some((side) => style.getPropertyValue(`border-${side.toLowerCase()}-width`) !== '0px');
        return own ? row.textContent?.trim().slice(0, 30) : null;
      })
      .filter(Boolean),
  );
  expect(nested, 'rows drawn as cards inside a card').toEqual([]);
}

/**
 * No field makes an iPhone zoom in: on a touch screen every visible input
 * and textarea is written at 16px or more (Safari zooms below that).
 */
async function expectNoZoomOnFocus(page: Page): Promise<void> {
  expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), 'a touch screen').toBe(true);
  const small = await page.locator('input:visible, textarea:visible').evaluateAll((fields) =>
    fields
      .map((field) => ({ name: field.getAttribute('aria-label') ?? field.getAttribute('placeholder') ?? field.getAttribute('name'), size: parseFloat(getComputedStyle(field).fontSize) }))
      .filter((field) => field.size < 16),
  );
  expect(small, 'fields that make iOS zoom in').toEqual([]);
}

/** The blocks of a page, stacked: every two in a row are as far apart as two cards. */
async function expectEvenStack(page: Page): Promise<void> {
  const gaps = await page.locator('.cards').first().evaluate((stack) => {
    const blocks = [...stack.children].filter((child) => getComputedStyle(child).display !== 'none' && child.getBoundingClientRect().height > 0);
    return blocks.slice(1).map((block, at) => Math.round(block.getBoundingClientRect().top - blocks[at]!.getBoundingClientRect().bottom));
  });
  expect(gaps.filter((gap) => gap !== 14), 'gaps between the blocks of the page other than 14px').toEqual([]);
}

/** An action that adds to a list, or a new block in a card, is set apart by the hairline. */
async function expectDivided(locator: Locator): Promise<void> {
  const top = await locator.evaluate((element) => getComputedStyle(element).borderTopWidth);
  expect(top, `${await locator.textContent()} is set apart`).toBe('1px');
}

/** On the phone an action button takes the whole width of the card (or form, or page) it is in. */
async function expectFullWidth(button: Locator): Promise<void> {
  const [own, room] = await button.evaluate((element) => {
    const box = element.closest('.card, .route, .cards')!;
    const style = getComputedStyle(box);
    return [element.getBoundingClientRect().width, box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)];
  });
  expect(Math.round(own), `${await button.textContent()} is as wide as its card`).toBe(Math.round(room));
}

/** A question on the phone is a sheet at the bottom: off the screen's sides, room for the home bar, two halves. */
async function expectRoomySheet(page: Page): Promise<void> {
  const sheet = page.getByRole('alertdialog');
  const box = await sheet.evaluate((element) => ({ bottom: parseFloat(getComputedStyle(element).paddingBottom), width: window.innerWidth }));
  expect(box.bottom, 'room under the buttons').toBeGreaterThanOrEqual(14);
  const buttons = await sheet.getByRole('button').evaluateAll((all) => all.map((one) => one.getBoundingClientRect()).map(({ left, right, width }) => ({ left, right, width })));
  expect(buttons).toHaveLength(2);
  for (const button of buttons) {
    expect(button.left, 'off the left side').toBeGreaterThanOrEqual(16);
    expect(box.width - button.right, 'off the right side').toBeGreaterThanOrEqual(16);
  }
  expect(Math.round(buttons[0]!.width), 'two halves').toBe(Math.round(buttons[1]!.width));
}

/**
 * Inside a card only the card pads: every block in it, every row and the
 * start of each row's text sit on the card's content edge, under its title.
 */
async function expectAligned(page: Page): Promise<void> {
  const off = await page.locator('.card:visible').evaluateAll((cards) =>
    cards.flatMap((card) => {
      const left = card.getBoundingClientRect().left + parseFloat(getComputedStyle(card).paddingLeft) + parseFloat(getComputedStyle(card).borderLeftWidth);
      const inside = [
        ...[...card.children].filter((child) => getComputedStyle(child).position !== 'absolute'),
        ...card.querySelectorAll('.row, .row .go, .row .open, button.day, .empty, .empty > *'),
      ];
      return inside
        .filter((element) => element.getBoundingClientRect().width > 0)
        .filter((element) => Math.abs(element.getBoundingClientRect().left - left) > 1)
        .map((element) => `${element.className.toString().split(' ')[0]}: ${(element.textContent ?? '').trim().slice(0, 24)} (${Math.round(element.getBoundingClientRect().left - left)}px)`);
    }),
  );
  expect(off, 'things inside a card off its content edge').toEqual([]);
}

const tile = (page: Page, name: string) => page.locator('dt', { hasText: new RegExp(`^${name}$`) }).locator('xpath=following-sibling::dd[1]');

test('from the first exercise to the stats of a lift', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));

  await page.goto(base());
  await expectNoZoomOnFocus(page);
  await expectFullWidth(page.getByRole('button', { name: 'Entra' }));
  await page.getByLabel('Utente').fill(process.env.E2E_USER!);
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: 'Entra' }).click();
  await expect(page.getByRole('heading', { name: 'Allenati' })).toBeVisible();
  // Before the door the app asks who you are and tries a renewal: two 401s the browser logs, as it should.
  errors.length = 0;

  // A short page does not scroll, nor bounce like it would (on an iPhone it moved under the clock).
  const page0 = await page.evaluate(() => ({
    scroll: document.documentElement.scrollHeight - window.innerHeight,
    html: getComputedStyle(document.documentElement).overscrollBehaviorY,
    body: getComputedStyle(document.body).overscrollBehaviorY,
  }));
  expect(page0).toEqual({ scroll: 0, html: 'none', body: 'none' });

  // The invitation to install, when the browser offers it, keeps the same gap as the cards.
  await page.evaluate(() =>
    window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: async () => undefined, userChoice: Promise.resolve({ outcome: 'dismissed' }) })),
  );
  await expect(page.getByRole('button', { name: 'Installa' })).toBeVisible();
  await expectEvenStack(page);
  await page.getByRole('button', { name: 'Non ora' }).click();
  await expectFullWidth(page.getByRole('button', { name: 'Allenamento libero' }));
  await expectAligned(page);

  // No plan yet: one way to write one, aligned like everything else.
  await page.getByRole('navigation', { name: 'Sezioni' }).getByRole('link', { name: 'Schede' }).click();
  await expect(page.getByRole('link', { name: 'Scrivi una scheda' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nuova' })).toHaveCount(0);
  await expectFullWidth(page.getByRole('link', { name: 'Scrivi una scheda' }));
  await expectAligned(page);

  // Two exercises.
  await page.getByRole('link', { name: 'Esercizi' }).click();
  await expect(page.getByRole('button', { name: 'Nuovo' })).toHaveCount(0);
  for (const name of ['Squat', 'Panca piana']) {
    await page.getByPlaceholder('Nuovo esercizio').fill(name);
    if (name === 'Squat') await page.getByPlaceholder('Nuovo esercizio').press('Enter');
    else await page.getByRole('button', { name: 'Crea', exact: true }).click();
    await expect(page.getByPlaceholder('Nuovo esercizio')).toHaveValue('');
  }
  await expect(page.locator('.row .name')).toHaveText(['Panca piana', 'Squat']);
  await expectFlatRows(page);
  await expectFullWidth(page.getByRole('button', { name: 'Crea', exact: true }));
  await expectAligned(page);
  await expectNoZoomOnFocus(page);

  // A plan: day A with Squat 3 × 8-10 and Panca, day B with Panca.
  await page.getByRole('link', { name: 'Schede' }).click();
  await page.getByRole('link', { name: 'Scrivi una scheda' }).click();
  await page.getByPlaceholder('Forza, autunno').fill('Forza');
  // a new plan is created on request; then it becomes the editor, which saves itself
  await expect(page.getByRole('button', { name: 'Aggiungi esercizio' })).toHaveCount(0);
  await expectFullWidth(page.getByRole('button', { name: 'Crea la scheda' }));
  await page.getByRole('button', { name: 'Crea la scheda' }).click();
  await expect(page).toHaveURL(/\/schede\/\d+$/);
  await page.getByRole('button', { name: 'Aggiungi esercizio' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Squat' }).click();
  for (const n of [1, 2, 3]) await page.getByLabel(`Serie ${n}, ripetizioni`).first().fill('8-10');
  await page.getByRole('button', { name: 'Aggiungi esercizio' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Panca piana' }).click();
  await page.getByRole('button', { name: 'Aggiungi giorno' }).click();
  await page.getByRole('button', { name: 'Aggiungi esercizio' }).nth(1).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Panca piana' }).click();
  await expectNoZoomOnFocus(page);
  for (const add of await page.locator('.add').all()) await expectDivided(add);
  for (const name of ['Aggiungi esercizio', 'Aggiungi giorno', 'Aggiungi una serie a Squat']) await expectFullWidth(page.getByRole('button', { name }).first());
  await page.getByRole('button', { name: 'Elimina la scheda «Forza»' }).click();
  await expectRoomySheet(page);
  await page.getByRole('alertdialog').getByRole('button', { name: 'Annulla' }).click();
  await expectAligned(page);
  await expectEvenStack(page);
  // No save button: the plan saves itself, and gets its own address once created.
  await expect(page.getByRole('button', { name: /Salva/ })).toHaveCount(0);
  await expect(page.getByRole('status', { name: 'Salvataggio' })).toHaveText('Salvata');
  await expect(page).toHaveURL(/\/schede\/\d+$/);

  // At the end of the editor its buttons are clear of the tab bar.
  await scrollToEnd(page);
  await expectClearOfTabBar(page, page.getByRole('button', { name: 'Aggiungi giorno' }));

  // A change made just before leaving is not lost.
  await page.getByPlaceholder('Forza, autunno').fill('Forza!');
  await page.getByRole('navigation', { name: 'Sezioni' }).getByRole('link', { name: 'Schede' }).click();
  await expect(page.getByRole('link', { name: /^Forza!/ })).toBeVisible();
  await page.getByRole('navigation', { name: 'Sezioni' }).getByRole('link', { name: 'Allenati' }).click();
  await expect(page.getByRole('heading', { name: 'Allenati' })).toBeVisible();
  await expectFlatRows(page);

  // The workout of day A: the first set needs its weight, the second repeats it plus 2,5.
  await page.getByRole('button', { name: 'A 2 esercizi' }).click();
  await expect(page.getByRole('heading', { name: 'Forza! · A' })).toBeVisible();
  await expect(page.getByLabel('Ripetizioni', { exact: true })).toHaveValue('8');
  await expect(page.getByLabel('Peso', { exact: true })).toHaveValue('');
  await page.getByLabel('Peso', { exact: true }).fill('60');
  await expectNoZoomOnFocus(page);
  await expectDivided(page.locator('.card .add').first());
  for (const name of ['Segna la serie 1', 'Aggiungi un esercizio', 'Termina']) await expectFullWidth(page.getByRole('button', { name }));
  await page.getByRole('button', { name: 'Segna la serie 1' }).click();
  await expectDivided(page.locator('.card .sets').first());
  await expectAligned(page);
  await expect(page.getByRole('button', { name: 'Segna la serie 2' })).toBeVisible();
  await expect(page.getByLabel('Peso', { exact: true })).toHaveValue('60');
  await page.getByRole('button', { name: 'Peso, più 2,5' }).click();
  await page.getByRole('button', { name: 'Segna la serie 2' }).click();
  await expect(page.locator('.set .what')).toHaveText(['8 × 60 kg', '8 × 62,5 kg']);
  await page.getByLabel('Nota', { exact: true }).first().fill('scendere più lento');
  await page.getByLabel('Nota', { exact: true }).first().blur();
  await expect(page.getByText('Salvata')).toBeVisible();

  // The rest the plan asks for runs above the tab bar, clear of the page's last buttons.
  const rest = page.getByRole('timer', { name: 'Recupero' });
  await expect(rest).toContainText(/Recupero 1:(30|29|28)/);
  await scrollToEnd(page);
  await expect(page.locator('header').getByRole('button', { name: 'Elimina l’allenamento' })).toBeVisible();
  const workoutButtons = [page.getByRole('button', { name: 'Termina' })];
  await expectClearOfTabBar(page, rest, ...workoutButtons);
  await expectUncovered(page, rest, ...workoutButtons);

  await page.getByRole('button', { name: 'Termina' }).click();
  await expect(page.locator('#toast')).toHaveText('Allenamento terminato.');
  await expect(rest).toBeHidden();
  await scrollToEnd(page);
  const finishedButtons = [page.getByRole('button', { name: 'Riapri' })];
  await expectFullWidth(finishedButtons[0]!);
  await expectClearOfTabBar(page, ...finishedButtons);
  await expect(page.locator('#toast')).toBeVisible();
  await expectToastClearOf(page, ...finishedButtons);

  // Leaving the page takes its message away. The next workout of day A shows the last time, and starts from its weight.
  await page.getByRole('link', { name: 'Allenati' }).first().click();
  await expect(page.locator('#toast')).toBeHidden();
  await page.getByRole('button', { name: 'A 2 esercizi' }).click();
  await expect(page.getByText('L’ultima volta').locator('..')).toContainText('Oggi · 8 × 60 kg, 8 × 62,5 kg');
  await expect(page.getByText('«scendere più lento»')).toBeVisible();
  await expect(page.getByLabel('Peso', { exact: true })).toHaveValue('60');

  // Three sections only; the exercises say how each is going, and a row opens its stats.
  await expect(page.getByRole('navigation', { name: 'Sezioni' }).getByRole('link')).toHaveText(['Allenati', 'Schede', 'Esercizi']);
  await page.getByRole('link', { name: 'Esercizi' }).click();
  await expect(page.getByRole('link', { name: /^Squat/ })).toContainText('media 61,25 kg · max 62,5 kg · 1 sessione · l’ultima oggi');
  await expect(page.getByRole('link', { name: /^Panca piana/ })).not.toContainText('media');
  await page.getByRole('link', { name: /^Squat/ }).click();
  await expect(page).toHaveURL(/\/esercizi\/\d+$/);
  await expect(page.getByRole('heading', { name: 'Squat' })).toBeVisible();
  await expect(page.getByRole('img')).toHaveCount(0);
  await expect(tile(page, 'Massimo')).toHaveText('62,5 kg');
  await expect(tile(page, 'Media')).toHaveText('61,25 kg');
  await expect(tile(page, '1RM stimato')).toHaveText('79,17 kg');
  await expect(tile(page, 'Volume')).toHaveText('980 kg');
  await expect(page.getByRole('row').nth(1).locator('td')).toHaveText(['Oggi', '2', '16', '980', '61,25', '62,5', '79,17']);
  // on the phone the sessions stay in rows: the header shown once, each session on one line, nothing wider than the screen
  await expect(page.locator('thead')).toBeVisible();
  const cells = await page.getByRole('row').nth(1).locator('td').evaluateAll((tds) => tds.map((td) => Math.round(td.getBoundingClientRect().top)));
  expect(new Set(cells).size).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const label = await page.getByRole('row').nth(1).locator('td').first().evaluate((td) => getComputedStyle(td, '::before').content);
  expect(['none', 'normal', '']).toContain(label);

  // The history, opened once, lists both and asks the server once.
  await page.getByRole('link', { name: 'Allenati' }).click();
  const asked: string[] = [];
  page.on('request', (request) => request.url().includes('/api/workouts?limit=20') && asked.push(request.url()));
  await page.getByRole('link', { name: 'Tutto lo storico' }).click();
  await expect(page.getByRole('heading', { name: 'Storico' })).toBeVisible();
  await expect(page.locator('.row')).toHaveCount(2);
  await expectFlatRows(page);
  await expectAligned(page);
  await expectEvenStack(page);
  await page.waitForTimeout(500);
  expect(asked).toHaveLength(1);

  expect(errors).toEqual([]);

  // Without network the app still opens, from the copy the service worker
  // keeps, and says what is missing instead of a browser error page.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Storico' })).toBeVisible();
  await page.context().setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Il server non risponde' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveText('Il telefono è senza rete, e la richiesta non è partita.');
  await page.context().setOffline(false);
  await page.getByRole('button', { name: 'Riprova' }).click();
  await expect(page.getByRole('heading', { name: 'Storico' })).toBeVisible();
});

test('a new person creates an account and is in at once', async ({ page }) => {
  await page.goto(base());
  await expect(page.locator('.stop-pin')).toHaveCount(0);
  await page.getByRole('button', { name: 'Crea un account' }).click();
  await expect(page.getByRole('heading', { name: 'Crea il tuo account' })).toBeVisible();
  await expectFullWidth(page.getByRole('button', { name: 'Crea l’account' }));
  await page.getByLabel('Utente').fill('Nuova.Persona');
  await page.getByLabel('Password', { exact: true }).fill('password lunga');
  await page.getByLabel('Ripeti la password').fill('password lunghe');
  await page.getByRole('button', { name: 'Crea l’account' }).click();
  await expect(page.getByRole('alert')).toHaveText('Le due password non coincidono.');
  await page.getByLabel('Password', { exact: true }).fill('password lunga');
  await page.getByLabel('Ripeti la password').fill('password lunga');
  await page.getByRole('button', { name: 'Crea l’account' }).click();
  await expect(page.getByRole('heading', { name: 'Allenati' })).toBeVisible();
  await page.getByRole('button', { name: /^Esci/ }).click();

  // the same name, any case, is taken; and it signs in lower-case
  await page.getByRole('button', { name: 'Crea un account' }).click();
  await page.getByLabel('Utente').fill('nuova.persona');
  await page.getByLabel('Password', { exact: true }).fill('password lunga');
  await page.getByLabel('Ripeti la password').fill('password lunga');
  await page.getByRole('button', { name: 'Crea l’account' }).click();
  await expect(page.getByRole('alert')).toHaveText('Questo nome utente è già preso.');
  await page.getByRole('button', { name: 'Ho già un account' }).click();
  await page.getByLabel('Utente').fill('NUOVA.persona');
  await page.getByLabel('Password', { exact: true }).fill('password lunga');
  await page.getByRole('button', { name: 'Entra' }).click();
  await expect(page.getByRole('heading', { name: 'Allenati' })).toBeVisible();
});
