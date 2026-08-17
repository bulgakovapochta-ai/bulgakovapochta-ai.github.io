<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Метод не поддерживается.'], JSON_UNESCAPED_UNICODE);
    exit;
}

require __DIR__ . '/mailer-config.php';

function finish(int $code, bool $ok, string $message): void {
    http_response_code($code);
    echo json_encode(['ok' => $ok, 'message' => $message], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function cutText(string $value, int $max): string {
    if (function_exists('mb_substr')) return mb_substr($value, 0, $max, 'UTF-8');
    return substr($value, 0, $max * 4);
}
function clean(string $value, int $max): string {
    $value = trim(preg_replace('/\s+/u', ' ', $value) ?? '');
    return cutText($value, $max);
}

// Простая защита от ботов и слишком частых отправок.
$honeypot = trim((string)($_POST['website'] ?? ''));
if ($honeypot !== '') finish(200, true, 'Заявка принята.');

$started = (int)($_POST['form_started'] ?? 0);
$now = time();
if ($started <= 0 || ($now - $started) < 3 || ($now - $started) > 86400) {
    finish(400, false, 'Обновите страницу и повторите отправку.');
}

$ip = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
$rateFile = sys_get_temp_dir() . '/kobzev_form_' . hash('sha256', $ip) . '.txt';
if (is_file($rateFile)) {
    $last = (int)@file_get_contents($rateFile);
    if ($last > 0 && ($now - $last) < 45) finish(429, false, 'Повторную заявку можно отправить через минуту.');
}
@file_put_contents($rateFile, (string)$now, LOCK_EX);

$name = clean((string)($_POST['name'] ?? ''), 80);
$phone = clean((string)($_POST['phone'] ?? ''), 40);
$emailRaw = trim((string)($_POST['email'] ?? ''));
$email = $emailRaw !== '' ? filter_var($emailRaw, FILTER_VALIDATE_EMAIL) : '';
$messageRaw = trim((string)($_POST['message'] ?? ''));
$message = cutText($messageRaw, 3000);
$consent = (string)($_POST['personal_data_consent'] ?? '');
$consentVersion = clean((string)($_POST['consent_version'] ?? ''), 30);

if ($name === '' || $message === '') finish(422, false, 'Заполните имя и описание ситуации.');
if ($phone === '' && $email === '') finish(422, false, 'Укажите телефон или корректный e-mail.');
if ($emailRaw !== '' && $email === false) finish(422, false, 'Проверьте адрес e-mail.');
if ($consent !== 'yes') finish(422, false, 'Для отправки заявки требуется согласие на обработку персональных данных.');
if (!isset($CONSENT_VERSION) || $consentVersion !== $CONSENT_VERSION) finish(422, false, 'Версия согласия изменилась. Обновите страницу.');

$host = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
$host = preg_replace('/:\d+$/', '', $host) ?? '';
$host = preg_replace('/^www\./', '', $host) ?? '';
if (!preg_match('/^[a-z0-9.-]+\.[a-z]{2,}$/i', $host)) $host = 'localhost.local';
$configuredFrom = isset($MAIL_FROM) ? trim((string)$MAIL_FROM) : '';
$fromEmail = filter_var($configuredFrom, FILTER_VALIDATE_EMAIL) ? $configuredFrom : ('noreply@' . $host);

$subjectText = 'Новая заявка с сайта — ' . $name;
$subject = '=?UTF-8?B?' . base64_encode($subjectText) . '?=';
$date = date('d.m.Y H:i:s');
$userAgent = clean((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 300);

$body = "Новая заявка с сайта\n"
      . "======================\n\n"
      . "Имя: {$name}\n"
      . "Телефон: " . ($phone !== '' ? $phone : 'не указан') . "\n"
      . "E-mail: " . ($email !== '' ? $email : 'не указан') . "\n\n"
      . "Сообщение:\n{$message}\n\n"
      . "---\n"
      . "Согласие на обработку ПД: ДА\n"
      . "Версия согласия: {$consentVersion}\n"
      . "Дата и время отправки: {$date}\n"
      . "IP: {$ip}\n"
      . "User-Agent: {$userAgent}\n";

$headers = [
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'From: ' . $SITE_NAME . ' <' . $fromEmail . '>',
    'X-Mailer: PHP/' . PHP_VERSION,
];
if ($email !== '') $headers[] = 'Reply-To: ' . $email;

$sent = @mail($MAIL_TO, $subject, $body, implode("\r\n", $headers));
if (!$sent) finish(500, false, 'Сервер не смог отправить письмо. Напишите в VK или позвоните.');

finish(200, true, 'Заявка отправлена.');
