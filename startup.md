# Startup через PM2 (с автозапуском после перезагрузки)

## 1. Установка PM2 (глобально)

```bash
npm i -g pm2
pm2 -v
```

## 2. Перейти в проект и установить зависимости

```bash
cd /path/to/orchid-workshop-pwa
npm ci
```

## 3. Проверить/заполнить переменные окружения

```bash
nano .env
```

Минимум проверь, что все нужные переменные для продакшена заданы (например, БД и секреты).

## 4. Собрать проект

```bash
npm run build
```

## 5. Запустить приложение через PM2

```bash
pm2 start npm --name orchid-workshop-pwa -- start
pm2 status
```

## 6. Включить автозапуск PM2 после reboot сервера

```bash
pm2 startup systemd -u $USER --hp $HOME
```

После этой команды PM2 выведет еще одну команду с `sudo` (нужно выполнить ее один раз).

## 7. Сохранить текущий список процессов PM2

```bash
pm2 save
```

## 8. Полезные команды управления

```bash
pm2 logs orchid-workshop-pwa
pm2 restart orchid-workshop-pwa
pm2 stop orchid-workshop-pwa
pm2 delete orchid-workshop-pwa
```

## 9. Проверка автоподъема после перезагрузки

```bash
sudo reboot
```

После перезагрузки:

```bash
pm2 status
```

Процесс `orchid-workshop-pwa` должен быть в статусе `online`.
