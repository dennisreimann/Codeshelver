set :user, "deploy"
set :application, "codeshelver"
set :domain, "codeshelver.com"
set :deploy_to, "/var/www/#{application}"
set :repository, "git@git.innovated.de:#{application}.git"
set :symlinks, { 'config/app.js' => 'config/app.js' }

require 'bundler/vlad'

namespace :vlad do

  desc 'Start the app'
  remote_task :start_app, :roles => :app do
    run "/etc/init.d/express_app #{application} start"
  end

  desc 'Stop the app'
  remote_task :stop_app, :roles => :app do
    run "/etc/init.d/express_app #{application} stop"
  end

  desc 'Restart the app'
  remote_task :restart_app, :roles => :app do
    %w(stop_app start_app).each { |task| Rake::Task["vlad:#{task}"].invoke }
  end

  desc 'Full deployment cycle'
  remote_task :deploy, :roles => :app do
    %w(update symlink ndistro:install_deps bundle:install restart_app cleanup).each do |task|
      Rake::Task["vlad:#{task}"].invoke
    end
  end
end